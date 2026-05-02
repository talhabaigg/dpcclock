<?php

namespace App\Services;

use App\Models\DrawingMeasurement;
use App\Models\TakeoffCondition;
use App\Models\Variation;
use App\Models\VariationPricingItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Keeps `variation_pricing_items` in sync with `drawing_measurements` for variation-scope measurements.
 *
 * Two flavours of auto-row, distinguished by which FK is set:
 *
 *   - Aggregated (`source='measurement'`, `takeoff_condition_id` set, `drawing_measurement_id` null):
 *     one row per (variation, condition); qty + costs summed across all matching measurements.
 *     Read-only in the UI except `sell_rate` / `sell_total`.
 *
 *   - Unpriced (`source='measurement'`, `drawing_measurement_id` set, `takeoff_condition_id` null):
 *     one row per measurement that has no condition. Mirrors description/qty/unit from the
 *     measurement; `labour_cost` / `material_cost` are user-entered and preserved across syncs.
 *
 * Manual rows (`source='manual'`) are untouched by this service.
 */
class VariationPricingSyncService
{
    /**
     * Recompute the aggregated auto-row for a (variation, condition) pair.
     * Upserts if matching measurements exist; deletes the row otherwise.
     */
    public function syncAggregated(int $variationId, int $conditionId): void
    {
        if ($this->variationLocked($variationId)) {
            return;
        }

        DB::transaction(function () use ($variationId, $conditionId) {
            $variation = Variation::lockForUpdate()->find($variationId);
            if (! $variation) {
                return;
            }

            // Sum top-level (parent) measurements; deductions subtract from their parent rows.
            // Because each measurement's labour_cost / material_cost / total_cost columns are
            // already kept current by TakeoffCostCalculator, we sum (parent − deductions) per
            // parent and add to the totals — this avoids re-running the calculator on aggregated
            // qty (which would lose perimeter info and per-measurement height overrides).
            $parents = DrawingMeasurement::query()
                ->where('variation_id', $variationId)
                ->where('takeoff_condition_id', $conditionId)
                ->where('scope', 'variation')
                ->whereNull('parent_measurement_id')
                ->with(['deductions' => function ($q) {
                    $q->select('id', 'parent_measurement_id', 'computed_value', 'labour_cost', 'material_cost', 'total_cost');
                }])
                ->get();

            if ($parents->isEmpty()) {
                $this->deleteAggregated($variationId, $conditionId);

                return;
            }

            $qty = 0.0;
            $labour = 0.0;
            $material = 0.0;
            $total = 0.0;

            foreach ($parents as $parent) {
                $netQty = (float) ($parent->computed_value ?? 0);
                $netLabour = (float) ($parent->labour_cost ?? 0);
                $netMaterial = (float) ($parent->material_cost ?? 0);
                $netTotal = (float) ($parent->total_cost ?? 0);

                foreach ($parent->deductions as $d) {
                    $netQty -= (float) ($d->computed_value ?? 0);
                    $netLabour -= (float) ($d->labour_cost ?? 0);
                    $netMaterial -= (float) ($d->material_cost ?? 0);
                    $netTotal -= (float) ($d->total_cost ?? 0);
                }

                $qty += max(0.0, $netQty);
                $labour += $netLabour;
                $material += $netMaterial;
                $total += $netTotal;
            }

            $condition = TakeoffCondition::with('conditionType')->find($conditionId);
            $unit = $condition?->conditionType?->unit ?? $parents->first()->unit ?? 'EA';

            $existing = VariationPricingItem::query()
                ->where('variation_id', $variationId)
                ->where('takeoff_condition_id', $conditionId)
                ->where('source', VariationPricingItem::SOURCE_MEASUREMENT)
                ->whereNull('drawing_measurement_id')
                ->lockForUpdate()
                ->first();

            // Adoption: if no aggregated auto-row exists yet, look for a pre-existing manual
            // row matching the same (variation, condition). If found, convert it to an auto-row
            // rather than creating a parallel duplicate. Pre-feature data and "I added it
            // manually then drew the measurement" both end up here.
            $adoptedFromManual = false;
            if (! $existing) {
                $existing = VariationPricingItem::query()
                    ->where('variation_id', $variationId)
                    ->where('takeoff_condition_id', $conditionId)
                    ->where('source', VariationPricingItem::SOURCE_MANUAL)
                    ->whereNull('drawing_measurement_id')
                    ->orderBy('id') // oldest first — preserves the user's original sell_rate
                    ->lockForUpdate()
                    ->first();
                $adoptedFromManual = (bool) $existing;
            }

            $payload = [
                'variation_id' => $variationId,
                'takeoff_condition_id' => $conditionId,
                'drawing_measurement_id' => null,
                'source' => VariationPricingItem::SOURCE_MEASUREMENT,
                'description' => $condition?->name ?? 'Condition #'.$conditionId,
                'qty' => round($qty, 4),
                'unit' => $unit,
                'labour_cost' => round($labour, 2),
                'material_cost' => round($material, 2),
                'total_cost' => round($total, 2),
                'last_synced_at' => now(),
            ];

            if ($existing) {
                $sellRate = $existing->sell_rate;
                $existing->fill($payload);
                if ($sellRate !== null) {
                    $existing->sell_rate = $sellRate;
                    $existing->sell_total = round($existing->qty * $sellRate, 2);
                }
                $existing->save();
            } else {
                $payload['sort_order'] = $this->nextAggregatedSortOrder($variationId);
                $existing = VariationPricingItem::create($payload);
            }

            // Merge any other manual rows that duplicate this auto-row's (variation, condition)
            // pair. The first matching manual row gets adopted above; any extras represent
            // duplicate work and get vacuumed up here. If our auto-row's sell_rate is null, we
            // adopt the highest sell_rate from the duplicates so the user's pricing isn't lost.
            $duplicates = VariationPricingItem::query()
                ->where('variation_id', $variationId)
                ->where('takeoff_condition_id', $conditionId)
                ->where('source', VariationPricingItem::SOURCE_MANUAL)
                ->whereNull('drawing_measurement_id')
                ->where('id', '!=', $existing->id)
                ->lockForUpdate()
                ->get();

            if ($duplicates->isNotEmpty()) {
                if ($existing->sell_rate === null) {
                    $bestRate = $duplicates->pluck('sell_rate')->filter()->max();
                    if ($bestRate !== null) {
                        $existing->sell_rate = round((float) $bestRate, 2);
                        $existing->sell_total = round($existing->qty * (float) $bestRate, 2);
                        $existing->save();
                    }
                }
                VariationPricingItem::whereIn('id', $duplicates->pluck('id'))->delete();
            }

            unset($adoptedFromManual); // value used only for clarity above
        });
    }

    /**
     * Recompute the unpriced auto-row for a (variation, measurement) pair.
     * Upserts if the measurement still qualifies (variation-scope, no condition); deletes otherwise.
     * Preserves user-entered labour_cost / material_cost / sell_rate across syncs.
     */
    public function syncUnpriced(int $variationId, int $measurementId): void
    {
        if ($this->variationLocked($variationId)) {
            return;
        }

        DB::transaction(function () use ($variationId, $measurementId) {
            $variation = Variation::lockForUpdate()->find($variationId);
            if (! $variation) {
                return;
            }

            // Use withTrashed so observer's deleted() can find the row to delete the auto-row.
            $measurement = DrawingMeasurement::withTrashed()->find($measurementId);

            $shouldExist = $measurement
                && $measurement->deleted_at === null
                && $measurement->scope === 'variation'
                && (int) $measurement->variation_id === $variationId
                && $measurement->takeoff_condition_id === null
                && $measurement->parent_measurement_id === null;

            $existing = VariationPricingItem::query()
                ->where('variation_id', $variationId)
                ->where('drawing_measurement_id', $measurementId)
                ->where('source', VariationPricingItem::SOURCE_MEASUREMENT)
                ->lockForUpdate()
                ->first();

            if (! $shouldExist) {
                $existing?->delete();

                return;
            }

            // Net qty after deductions (deductions inherit their parent for rollup purposes).
            $netQty = (float) ($measurement->computed_value ?? 0);
            $deductions = DrawingMeasurement::query()
                ->where('parent_measurement_id', $measurementId)
                ->get(['computed_value']);
            foreach ($deductions as $d) {
                $netQty -= (float) ($d->computed_value ?? 0);
            }
            $netQty = max(0.0, $netQty);

            $description = $measurement->name && trim($measurement->name) !== ''
                ? $measurement->name
                : ucfirst($measurement->type ?? 'measurement').' #'.$measurement->id;

            $unit = $measurement->unit ?? 'EA';

            if ($existing) {
                $existing->description = $description;
                $existing->qty = round($netQty, 4);
                $existing->unit = $unit;
                if ($existing->sell_rate !== null) {
                    $existing->sell_total = round($existing->qty * (float) $existing->sell_rate, 2);
                }
                $existing->total_cost = round((float) $existing->labour_cost + (float) $existing->material_cost, 2);
                $existing->last_synced_at = now();
                $existing->save();
            } else {
                VariationPricingItem::create([
                    'variation_id' => $variationId,
                    'takeoff_condition_id' => null,
                    'drawing_measurement_id' => $measurementId,
                    'source' => VariationPricingItem::SOURCE_MEASUREMENT,
                    'description' => $description,
                    'qty' => round($netQty, 4),
                    'unit' => $unit,
                    'labour_cost' => 0,
                    'material_cost' => 0,
                    'total_cost' => 0,
                    'sort_order' => $this->nextUnpricedSortOrder($variationId),
                    'last_synced_at' => now(),
                ]);
            }
        });
    }

    /**
     * Re-runs every auto-row for a variation. Used by the artisan backfill and the
     * "Refresh from measurements" button in the UI.
     */
    public function syncVariation(int $variationId): void
    {
        if ($this->variationLocked($variationId)) {
            return;
        }

        $conditionIds = DrawingMeasurement::query()
            ->where('variation_id', $variationId)
            ->where('scope', 'variation')
            ->whereNotNull('takeoff_condition_id')
            ->whereNull('parent_measurement_id')
            ->pluck('takeoff_condition_id')
            ->unique();

        foreach ($conditionIds as $conditionId) {
            $this->syncAggregated($variationId, (int) $conditionId);
        }

        // Also re-evaluate any aggregated rows that have no measurements left (orphans).
        $existingAggregatedConditionIds = VariationPricingItem::query()
            ->where('variation_id', $variationId)
            ->where('source', VariationPricingItem::SOURCE_MEASUREMENT)
            ->whereNotNull('takeoff_condition_id')
            ->whereNull('drawing_measurement_id')
            ->pluck('takeoff_condition_id')
            ->unique();

        foreach ($existingAggregatedConditionIds->diff($conditionIds) as $orphanedConditionId) {
            $this->syncAggregated($variationId, (int) $orphanedConditionId);
        }

        $unpricedMeasurementIds = DrawingMeasurement::query()
            ->where('variation_id', $variationId)
            ->where('scope', 'variation')
            ->whereNull('takeoff_condition_id')
            ->whereNull('parent_measurement_id')
            ->pluck('id')
            ->unique();

        foreach ($unpricedMeasurementIds as $measurementId) {
            $this->syncUnpriced($variationId, (int) $measurementId);
        }

        $existingUnpricedMeasurementIds = VariationPricingItem::query()
            ->where('variation_id', $variationId)
            ->where('source', VariationPricingItem::SOURCE_MEASUREMENT)
            ->whereNotNull('drawing_measurement_id')
            ->pluck('drawing_measurement_id')
            ->unique();

        foreach ($existingUnpricedMeasurementIds->diff($unpricedMeasurementIds) as $orphanedMeasurementId) {
            $this->syncUnpriced($variationId, (int) $orphanedMeasurementId);
        }
    }

    /**
     * Resolves all auto-row keys affected by a measurement change and re-syncs each.
     * Pulls previous values from getOriginal() so old rows shrink/disappear correctly
     * when condition/scope/variation change.
     *
     * Pass null/null/null for $previous* on `created`; pass the original values from
     * the model on `updated`/`deleted`/`restored`.
     */
    public function handleMeasurementChange(
        DrawingMeasurement $measurement,
        ?int $previousVariationId,
        ?int $previousConditionId,
        ?string $previousScope,
        bool $treatAsDeleted = false,
    ): void {
        // Skip deduction children — their parent's row already reflects the net qty.
        // (If a child changes, observer fires for the child, but we sync the parent's keys.)
        $isChild = $measurement->parent_measurement_id !== null;
        $wasChild = ($measurement->getOriginal('parent_measurement_id') ?? null) !== null;

        if ($isChild || $wasChild) {
            $this->resyncForChildChange($measurement, $previousVariationId);

            return;
        }

        $currentScope = $treatAsDeleted ? null : $measurement->scope;
        $currentVariationId = $treatAsDeleted ? null : $measurement->variation_id;
        $currentConditionId = $treatAsDeleted ? null : $measurement->takeoff_condition_id;

        // Current state
        $this->resyncKey($currentVariationId, $currentConditionId, $measurement->id, $currentScope);

        // Previous state — only if any of the three fields changed
        $changed = $previousVariationId !== $currentVariationId
            || $previousConditionId !== $currentConditionId
            || $previousScope !== $currentScope;

        if ($changed) {
            $this->resyncKey($previousVariationId, $previousConditionId, $measurement->id, $previousScope);
        }
    }

    private function resyncKey(?int $variationId, ?int $conditionId, int $measurementId, ?string $scope): void
    {
        if ($variationId === null) {
            return;
        }

        if ($scope === 'variation' && $conditionId !== null) {
            $this->syncAggregated($variationId, $conditionId);

            return;
        }

        // Either scope='variation' with no condition (current/prev unpriced)
        // or scope changed away — syncUnpriced will delete the row if it doesn't qualify.
        $this->syncUnpriced($variationId, $measurementId);
    }

    /**
     * When a deduction child changes, resync the parent's aggregated row (or unpriced row).
     */
    private function resyncForChildChange(DrawingMeasurement $child, ?int $previousVariationId): void
    {
        $parentId = $child->parent_measurement_id ?? $child->getOriginal('parent_measurement_id');
        if (! $parentId) {
            return;
        }

        $parent = DrawingMeasurement::withTrashed()->find($parentId);
        if (! $parent) {
            return;
        }

        if ($parent->variation_id) {
            if ($parent->takeoff_condition_id) {
                $this->syncAggregated($parent->variation_id, $parent->takeoff_condition_id);
            } else {
                $this->syncUnpriced($parent->variation_id, $parent->id);
            }
        }

        if ($previousVariationId && $previousVariationId !== $parent->variation_id) {
            // Child moved between variations — sync the previous parent row too if locatable.
            $prevParent = DrawingMeasurement::withTrashed()
                ->where('variation_id', $previousVariationId)
                ->find($parentId);
            if ($prevParent) {
                if ($prevParent->takeoff_condition_id) {
                    $this->syncAggregated($previousVariationId, $prevParent->takeoff_condition_id);
                } else {
                    $this->syncUnpriced($previousVariationId, $prevParent->id);
                }
            }
        }
    }

    private function variationLocked(int $variationId): bool
    {
        $locked = Variation::query()
            ->where('id', $variationId)
            ->whereNotNull('premier_co_id')
            ->exists();

        if ($locked) {
            Log::info('VariationPricingSyncService: skipping sync for locked variation', [
                'variation_id' => $variationId,
            ]);
        }

        return $locked;
    }

    private function deleteAggregated(int $variationId, int $conditionId): void
    {
        VariationPricingItem::query()
            ->where('variation_id', $variationId)
            ->where('takeoff_condition_id', $conditionId)
            ->where('source', VariationPricingItem::SOURCE_MEASUREMENT)
            ->whereNull('drawing_measurement_id')
            ->delete();
    }

    private function nextAggregatedSortOrder(int $variationId): int
    {
        // Aggregated rows go first (lowest sort_order).
        $min = VariationPricingItem::query()
            ->where('variation_id', $variationId)
            ->min('sort_order');

        return ($min !== null ? (int) $min : 0) - 1;
    }

    private function nextUnpricedSortOrder(int $variationId): int
    {
        // Unpriced go after aggregated but before manual; using mid-range negative numbers.
        $max = VariationPricingItem::query()
            ->where('variation_id', $variationId)
            ->where('source', VariationPricingItem::SOURCE_MEASUREMENT)
            ->whereNotNull('drawing_measurement_id')
            ->max('sort_order');

        return ($max !== null ? (int) $max : -1000) + 1;
    }
}
