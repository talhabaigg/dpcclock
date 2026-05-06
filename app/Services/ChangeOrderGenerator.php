<?php

namespace App\Services;

use App\Models\Location;
use App\Models\TakeoffCondition;
use App\Models\Variation;

class ChangeOrderGenerator
{
    public function __construct(
        private VariationCostCalculator $calculator,
    ) {}

    /**
     * Generate change order line items from a condition + quantity.
     *
     * Returns an array of line item data ready for VariationLineItem::create().
     * Includes: base labour/material lines + oncost lines from variation_ratios.
     *
     * @return array{line_items: array, summary: array}
     */
    public function generate(
        TakeoffCondition $condition,
        float $qty,
        Location $location,
        ?int $drawingMeasurementId = null,
    ): array {
        $costs = $this->calculator->compute($condition, $qty);

        $locationCostCodes = $location->costCodes()
            ->with('costType')
            ->distinct()
            ->get();

        $lineItems = [];
        $lineNumber = 1;

        // Base labour line
        if ($costs['labour_base'] > 0) {
            $lineItems[] = [
                'line_number' => $lineNumber++,
                'description' => "{$condition->name} - Base Labour",
                'qty' => 1,
                'unit_cost' => $costs['labour_base'],
                'total_cost' => $costs['labour_base'],
                'cost_item' => $this->findBaseCostCode($locationCostCodes, 'LAB'),
                'cost_type' => 'LAB',
                'revenue' => 0,
                'takeoff_condition_id' => $condition->id,
                'drawing_measurement_id' => $drawingMeasurementId,
                'cost_code_id' => $this->findBaseCostCodeId($locationCostCodes, 'LAB'),
            ];
        }

        // Base material line
        if ($costs['material_base'] > 0) {
            $lineItems[] = [
                'line_number' => $lineNumber++,
                'description' => "{$condition->name} - Base Material",
                'qty' => 1,
                'unit_cost' => $costs['material_base'],
                'total_cost' => $costs['material_base'],
                'cost_item' => $this->findBaseCostCode($locationCostCodes, 'MAT'),
                'cost_type' => 'MAT',
                'revenue' => 0,
                'takeoff_condition_id' => $condition->id,
                'drawing_measurement_id' => $drawingMeasurementId,
                'cost_code_id' => $this->findBaseCostCodeId($locationCostCodes, 'MAT'),
            ];
        }

        // Oncost lines from variation_ratios
        foreach ($locationCostCodes as $costCode) {
            $variationRatio = (float) ($costCode->pivot->variation_ratio ?? 0);
            $prelimType = strtoupper(trim($costCode->pivot->prelim_type ?? ''));

            if ($variationRatio <= 0) {
                continue;
            }

            $percent = $variationRatio / 100;

            if (str_starts_with($prelimType, 'LAB') && $costs['labour_base'] > 0) {
                $lineAmount = round($costs['labour_base'] * $percent, 2);
                $lineItems[] = [
                    'line_number' => $lineNumber++,
                    'description' => $costCode->description,
                    'qty' => 1,
                    'unit_cost' => $lineAmount,
                    'total_cost' => $lineAmount,
                    'cost_item' => $costCode->code,
                    'cost_type' => $costCode->costType?->code ?? '',
                    'revenue' => 0,
                    'takeoff_condition_id' => $condition->id,
                    'drawing_measurement_id' => $drawingMeasurementId,
                    'cost_code_id' => $costCode->id,
                ];
            } elseif (str_starts_with($prelimType, 'MAT') && $costs['material_base'] > 0) {
                $lineAmount = round($costs['material_base'] * $percent, 2);
                $lineItems[] = [
                    'line_number' => $lineNumber++,
                    'description' => $costCode->description,
                    'qty' => 1,
                    'unit_cost' => $lineAmount,
                    'total_cost' => $lineAmount,
                    'cost_item' => $costCode->code,
                    'cost_type' => $costCode->costType?->code ?? '',
                    'revenue' => 0,
                    'takeoff_condition_id' => $condition->id,
                    'drawing_measurement_id' => $drawingMeasurementId,
                    'cost_code_id' => $costCode->id,
                ];
            }
        }

        $totalCost = array_sum(array_column($lineItems, 'total_cost'));

        return [
            'line_items' => $lineItems,
            'summary' => [
                'condition_name' => $condition->name,
                'qty' => $qty,
                'labour_base' => $costs['labour_base'],
                'material_base' => $costs['material_base'],
                'total_cost' => $totalCost,
            ],
        ];
    }

    /**
     * Generate line items and create them on an existing variation.
     */
    public function generateAndSave(
        Variation $variation,
        TakeoffCondition $condition,
        float $qty,
        Location $location,
        ?int $drawingMeasurementId = null,
    ): array {
        $result = $this->generate(
            $condition,
            $qty,
            $location,
            $drawingMeasurementId,
        );

        // Remove existing lines for the same condition + measurement to prevent duplicates
        $variation->lineItems()
            ->where('takeoff_condition_id', $condition->id)
            ->where('drawing_measurement_id', $drawingMeasurementId)
            ->delete();

        // Re-number all remaining lines, then append new ones
        $existingCount = $variation->lineItems()->count();
        foreach ($result['line_items'] as &$item) {
            $item['line_number'] += $existingCount;
            $variation->lineItems()->create($item);
        }

        return $result;
    }

    /**
     * Preview costs without saving — for the frontend cost preview panel.
     */
    public function preview(
        TakeoffCondition $condition,
        float $qty,
        Location $location,
    ): array {
        $result = $this->generate($condition, $qty, $location);

        // Group oncosts by prelim type for summary
        $labOncosts = 0;
        $matOncosts = 0;
        foreach ($result['line_items'] as $item) {
            if (str_contains($item['description'], 'Base Labour') || str_contains($item['description'], 'Base Material')) {
                continue;
            }
            // Oncost lines inherit the prelim_type grouping based on which base they derived from
            // LAB oncosts come before MAT oncosts in the line items list, but we check cost_type
            if (str_starts_with(strtoupper($item['cost_type'] ?? ''), 'LAB') || str_contains($item['description'], 'Labour')) {
                $labOncosts += $item['total_cost'];
            } else {
                $matOncosts += $item['total_cost'];
            }
        }

        return [
            'labour_base' => $result['summary']['labour_base'],
            'material_base' => $result['summary']['material_base'],
            'labour_oncosts' => round($labOncosts, 2),
            'material_oncosts' => round($matOncosts, 2),
            'total_cost' => $result['summary']['total_cost'],
            'line_count' => count($result['line_items']),
        ];
    }

    /**
     * Generate Premier line items from a variation's pricing items.
     *
     * Labour: Quick Gen logic — totalLabour × each LAB cost code's variation_ratio
     * (or dayworks_ratio when $mode === 'dayworks').
     * Material: Actual cost codes from conditions (aggregated), then MAT Quick Gen on total.
     * Manual pricing items contribute labour only; their material is excluded.
     *
     * Wipes existing line items and creates new ones.
     *
     * @param  string  $mode  'standard' (uses variation_ratio) | 'dayworks' (uses dayworks_ratio)
     * @return array{line_items: array, summary: array}
     */
    public function generateFromPricingItems(Variation $variation, Location $location, string $mode = 'standard'): array
    {
        $ratioColumn = $mode === 'dayworks' ? 'dayworks_ratio' : 'variation_ratio';
        $variation->loadMissing('pricingItems', 'directMaterials.costCode.costType');

        // ── Step 1: Collect costs from pricing items ──
        $totalLabour = 0;
        // materialByCostCode: keyed by cost_code string, value = [cost_code_id, description, total]
        $materialByCostCode = [];

        // Direct material rows roll up by cost code → one Premier line per cost
        // code with sum(qty × unit_cost). Lines are emitted at Step 3 (alongside
        // condition-derived material lines).
        foreach ($variation->directMaterials as $dm) {
            $cc = $dm->costCode;
            if (! $cc || ! $cc->code) {
                continue;
            }
            $code = $cc->code;
            if (! isset($materialByCostCode[$code])) {
                $materialByCostCode[$code] = [
                    'cost_code_id' => $cc->id,
                    'description' => $cc->description ?: $code,
                    'cost_type' => $cc->costType?->code ?? 'MAT',
                    'total' => 0,
                ];
            }
            $materialByCostCode[$code]['total'] += (float) $dm->qty * (float) $dm->unit_cost;
        }

        foreach ($variation->pricingItems as $item) {
            // Manual rows: labour_cost is a unit rate → multiply by qty.
            // Condition rows: labour_cost is already a line total (calculator pre-multiplied).
            $totalLabour += $item->takeoff_condition_id
                ? (float) $item->labour_cost
                : (float) $item->labour_cost * (float) $item->qty;

            if (! $item->takeoff_condition_id) {
                // Manual item — labour only, material excluded from Premier
                continue;
            }

            // Re-compute condition to get cost code breakdown
            $condition = TakeoffCondition::with([
                'costCodes.costCode',
                'boqItems.costCode',
                'boqItems.labourCostCode',
            ])->find($item->takeoff_condition_id);

            if (! $condition) {
                continue;
            }

            $costs = $this->calculator->compute($condition, (float) $item->qty);

            // Unit rate: breakdown has cost_code_id per cost code.
            // Detailed support not yet wired here — VariationCostCalculator
            // throws for detailed conditions until that lands.
            foreach ($costs['breakdown']['cost_codes'] ?? [] as $cc) {
                $code = $cc['cost_code'] ?? null;
                if (! $code) {
                    continue;
                }
                if (! isset($materialByCostCode[$code])) {
                    $materialByCostCode[$code] = [
                        'cost_code_id' => $cc['cost_code_id'],
                        'description' => $cc['description'] ?? $code,
                        'total' => 0,
                    ];
                }
                $materialByCostCode[$code]['total'] += $cc['line_cost'];
            }
        }

        $locationCostCodes = $location->costCodes()
            ->with('costType')
            ->distinct()
            ->get();

        $lineItems = [];
        $lineNumber = 1;

        // ── Step 2: Labour lines ──
        // Project convention: LAB-prefix cost codes' variation_ratios already
        // capture both the base labour (e.g. 01-01 with ratio=100%) AND the
        // oncosts on top. Sum of LAB ratios = total fan-out as a percentage of
        // labour. Do NOT emit a separate base line — that would double-count.
        // Fallback: if no LAB ratios fan out at all, emit the labour total as
        // a single line so it isn't silently dropped (skipped in dayworks mode).
        $labourLinesEmitted = 0;
        if ($totalLabour > 0) {
            foreach ($locationCostCodes as $costCode) {
                $ratio = (float) ($costCode->pivot->{$ratioColumn} ?? 0);
                $prelimType = strtoupper(trim($costCode->pivot->prelim_type ?? ''));

                if ($ratio <= 0 || ! str_starts_with($prelimType, 'LAB')) {
                    continue;
                }

                $lineAmount = round($totalLabour * ($ratio / 100), 2);
                $lineItems[] = [
                    'line_number' => $lineNumber++,
                    'description' => $costCode->description,
                    'qty' => 1,
                    'unit_cost' => $lineAmount,
                    'total_cost' => $lineAmount,
                    'cost_item' => $costCode->code,
                    'cost_type' => $costCode->costType?->code ?? '',
                    'revenue' => 0,
                    'cost_code_id' => $costCode->id,
                ];
                $labourLinesEmitted++;
            }

            if ($labourLinesEmitted === 0 && $mode !== 'dayworks') {
                $fallback = $this->findFallbackLabourCostCode($locationCostCodes);
                $lineItems[] = [
                    'line_number' => $lineNumber++,
                    'description' => $fallback?->description ?? 'Labour',
                    'qty' => 1,
                    'unit_cost' => round($totalLabour, 2),
                    'total_cost' => round($totalLabour, 2),
                    'cost_item' => $fallback?->code ?? 'LAB',
                    'cost_type' => $fallback?->costType?->code ?? 'LAB',
                    'revenue' => 0,
                    'cost_code_id' => $fallback?->id,
                ];
            }
        }

        // ── Step 3: Direct material lines (from conditions and direct-material rows) ──
        $totalMaterial = 0;
        foreach ($materialByCostCode as $code => $data) {
            $amount = round($data['total'], 2);
            if ($amount <= 0) {
                continue;
            }
            $totalMaterial += $amount;
            $lineItems[] = [
                'line_number' => $lineNumber++,
                'description' => $data['description'],
                'qty' => 1,
                'unit_cost' => $amount,
                'total_cost' => $amount,
                'cost_item' => $code,
                'cost_type' => $data['cost_type'] ?? 'MAT',
                'revenue' => 0,
                'cost_code_id' => $data['cost_code_id'],
            ];
        }

        // ── Step 4: Material prelim lines (Quick Gen logic) ──
        if ($totalMaterial > 0) {
            foreach ($locationCostCodes as $costCode) {
                $ratio = (float) ($costCode->pivot->{$ratioColumn} ?? 0);
                $prelimType = strtoupper(trim($costCode->pivot->prelim_type ?? ''));

                if ($ratio <= 0 || ! str_starts_with($prelimType, 'MAT')) {
                    continue;
                }

                $lineAmount = round($totalMaterial * ($ratio / 100), 2);
                $lineItems[] = [
                    'line_number' => $lineNumber++,
                    'description' => $costCode->description,
                    'qty' => 1,
                    'unit_cost' => $lineAmount,
                    'total_cost' => $lineAmount,
                    'cost_item' => $costCode->code,
                    'cost_type' => $costCode->costType?->code ?? '',
                    'revenue' => 0,
                    'cost_code_id' => $costCode->id,
                ];
            }
        }

        // Wipe existing and create new
        $variation->lineItems()->delete();
        foreach ($lineItems as $item) {
            $variation->lineItems()->create($item);
        }

        // Per-row premier cost: simulate the fan-out per pricing item and
        // persist the per-unit value. The Client tab uses this to surface the
        // realised premier cost alongside the user's input cost.
        foreach ($variation->pricingItems as $pricingItem) {
            $perUnit = $this->perUnitPremierCost([
                'labour_cost' => (float) $pricingItem->labour_cost,
                'material_cost' => (float) $pricingItem->material_cost,
                'qty' => (float) $pricingItem->qty,
                'takeoff_condition_id' => $pricingItem->takeoff_condition_id,
            ], $location, $mode);

            $pricingItem->premier_cost_per_unit = $perUnit;
            $pricingItem->save();
        }

        // Lines are now in sync with pricing items.
        $variation->premier_lines_stale = false;
        $variation->save();

        $totalCost = array_sum(array_column($lineItems, 'total_cost'));

        return [
            'line_items' => $lineItems,
            'summary' => [
                'labour_base' => round($totalLabour, 2),
                'material_base' => round($totalMaterial, 2),
                'total_cost' => $totalCost,
                'line_count' => count($lineItems),
            ],
        ];
    }

    /**
     * Compute the per-unit premier cost for a pricing item shape.
     * Returns 0.0 when qty is non-positive to avoid divide-by-zero.
     */
    private function perUnitPremierCost(array $item, Location $location, string $mode): float
    {
        $qty = (float) ($item['qty'] ?? 0);
        if ($qty <= 0) {
            return 0.0;
        }

        $total = $this->computeRowPremierCost($item, $location, $mode);

        return round($total / $qty, 4);
    }

    /**
     * Same logic as generateFromPricingItems but does NOT save — returns line items only.
     *
     * @param  array  $pricingItems  Raw pricing item data from the request
     * @param  string  $mode  'standard' (uses variation_ratio) | 'dayworks' (uses dayworks_ratio)
     * @return array{line_items: array, summary: array}
     */
    public function previewFromPricingItems(array $pricingItems, Location $location, string $mode = 'standard'): array
    {
        $ratioColumn = $mode === 'dayworks' ? 'dayworks_ratio' : 'variation_ratio';
        $totalLabour = 0;
        $materialByCostCode = [];

        foreach ($pricingItems as $item) {
            $conditionId = $item['takeoff_condition_id'] ?? null;
            // Manual rows store labour_cost as a unit rate; multiply by qty.
            $totalLabour += $conditionId
                ? (float) ($item['labour_cost'] ?? 0)
                : (float) ($item['labour_cost'] ?? 0) * (float) ($item['qty'] ?? 1);

            if (! $conditionId) {
                continue;
            }

            $condition = TakeoffCondition::with([
                'costCodes.costCode',
                'boqItems.costCode',
                'boqItems.labourCostCode',
            ])->find($conditionId);

            if (! $condition) {
                continue;
            }

            $costs = $this->calculator->compute($condition, (float) ($item['qty'] ?? 1));

            // Unit rate only — VariationCostCalculator throws for detailed conditions
            // until detailed variation pricing is implemented.
            foreach ($costs['breakdown']['cost_codes'] ?? [] as $cc) {
                $code = $cc['cost_code'] ?? null;
                if (! $code) {
                    continue;
                }
                if (! isset($materialByCostCode[$code])) {
                    $materialByCostCode[$code] = [
                        'cost_code_id' => $cc['cost_code_id'],
                        'description' => $cc['description'] ?? $code,
                        'total' => 0,
                    ];
                }
                $materialByCostCode[$code]['total'] += $cc['line_cost'];
            }
        }

        $locationCostCodes = $location->costCodes()->with('costType')->distinct()->get();

        $lineItems = [];
        $lineNumber = 1;

        if ($totalLabour > 0) {
            foreach ($locationCostCodes as $costCode) {
                $ratio = (float) ($costCode->pivot->{$ratioColumn} ?? 0);
                $prelimType = strtoupper(trim($costCode->pivot->prelim_type ?? ''));

                if ($ratio <= 0 || ! str_starts_with($prelimType, 'LAB')) {
                    continue;
                }

                $lineAmount = round($totalLabour * ($ratio / 100), 2);
                $lineItems[] = [
                    'line_number' => $lineNumber++,
                    'description' => $costCode->description,
                    'qty' => 1,
                    'unit_cost' => $lineAmount,
                    'total_cost' => $lineAmount,
                    'cost_item' => $costCode->code,
                    'cost_type' => $costCode->costType?->code ?? '',
                    'revenue' => 0,
                    'cost_code_id' => $costCode->id,
                ];
            }
        }

        $totalMaterial = 0;
        foreach ($materialByCostCode as $code => $data) {
            $amount = round($data['total'], 2);
            if ($amount <= 0) {
                continue;
            }
            $totalMaterial += $amount;
            $lineItems[] = [
                'line_number' => $lineNumber++,
                'description' => $data['description'],
                'qty' => 1,
                'unit_cost' => $amount,
                'total_cost' => $amount,
                'cost_item' => $code,
                'cost_type' => 'MAT',
                'revenue' => 0,
                'cost_code_id' => $data['cost_code_id'],
            ];
        }

        if ($totalMaterial > 0) {
            foreach ($locationCostCodes as $costCode) {
                $ratio = (float) ($costCode->pivot->{$ratioColumn} ?? 0);
                $prelimType = strtoupper(trim($costCode->pivot->prelim_type ?? ''));

                if ($ratio <= 0 || ! str_starts_with($prelimType, 'MAT')) {
                    continue;
                }

                $lineAmount = round($totalMaterial * ($ratio / 100), 2);
                $lineItems[] = [
                    'line_number' => $lineNumber++,
                    'description' => $costCode->description,
                    'qty' => 1,
                    'unit_cost' => $lineAmount,
                    'total_cost' => $lineAmount,
                    'cost_item' => $costCode->code,
                    'cost_type' => $costCode->costType?->code ?? '',
                    'revenue' => 0,
                    'cost_code_id' => $costCode->id,
                ];
            }
        }

        $totalCost = array_sum(array_column($lineItems, 'total_cost'));

        // Per-row premier cost (per unit), keyed by input order so the
        // frontend can map results back to its local pricing-item array.
        $perRow = [];
        foreach ($pricingItems as $idx => $row) {
            $perRow[] = [
                'index' => $idx,
                'premier_cost_per_unit' => $this->perUnitPremierCost([
                    'labour_cost' => (float) ($row['labour_cost'] ?? 0),
                    'material_cost' => (float) ($row['material_cost'] ?? 0),
                    'qty' => (float) ($row['qty'] ?? 0),
                    'takeoff_condition_id' => $row['takeoff_condition_id'] ?? null,
                ], $location, $mode),
            ];
        }

        return [
            'line_items' => $lineItems,
            'per_row_premier' => $perRow,
            'summary' => [
                'labour_base' => round($totalLabour, 2),
                'material_base' => round($totalMaterial, 2),
                'total_cost' => $totalCost,
                'line_count' => count($lineItems),
            ],
        ];
    }

    /**
     * Compute the per-row premier cost for a single pricing item.
     *
     * Runs the same fan-out logic as generateFromPricingItems but treats
     * this item as if it were the only pricing item on the variation.
     * Returns the total simulated cost (base labour/material + oncosts).
     *
     * For pricing items with a condition, the condition's cost-code material
     * breakdown is used. For manual items, material is excluded (matching
     * generateFromPricingItems behavior).
     *
     * @param  array{labour_cost: float, material_cost: float, qty: float, takeoff_condition_id: int|null}  $item
     */
    public function computeRowPremierCost(array $item, Location $location, string $mode = 'standard'): float
    {
        $ratioColumn = $mode === 'dayworks' ? 'dayworks_ratio' : 'variation_ratio';

        $conditionId = $item['takeoff_condition_id'] ?? null;
        $rawLabour = (float) ($item['labour_cost'] ?? 0);
        // Manual rows store labour_cost as a UNIT RATE (total = qty × labour),
        // so we multiply by qty to get the line total. Condition rows store
        // labour_cost as a LINE TOTAL already (the calculator pre-multiplies).
        $totalLabour = $conditionId ? $rawLabour : $rawLabour * (float) ($item['qty'] ?? 1);
        $materialByCostCode = [];
        if ($conditionId) {
            $condition = TakeoffCondition::with([
                'costCodes.costCode',
                'boqItems.costCode',
                'boqItems.labourCostCode',
            ])->find($conditionId);

            if ($condition) {
                $costs = $this->calculator->compute($condition, (float) ($item['qty'] ?? 1));
                foreach ($costs['breakdown']['cost_codes'] ?? [] as $cc) {
                    $code = $cc['cost_code'] ?? null;
                    if (! $code) {
                        continue;
                    }
                    if (! isset($materialByCostCode[$code])) {
                        $materialByCostCode[$code] = ['total' => 0];
                    }
                    $materialByCostCode[$code]['total'] += $cc['line_cost'];
                }
            }
        }

        $locationCostCodes = $location->costCodes()->with('costType')->distinct()->get();

        $total = 0.0;

        // Labour fan-out — mirrors generateFromPricingItems.
        // Project convention: LAB-prefix ratios already capture both base and
        // oncosts, so no separate base line. Fallback for the no-ratios case
        // emits totalLabour as a single line so it isn't dropped.
        $labourLinesEmitted = 0;
        if ($totalLabour > 0) {
            foreach ($locationCostCodes as $costCode) {
                $ratio = (float) ($costCode->pivot->{$ratioColumn} ?? 0);
                $prelimType = strtoupper(trim($costCode->pivot->prelim_type ?? ''));

                if ($ratio <= 0 || ! str_starts_with($prelimType, 'LAB')) {
                    continue;
                }

                $total += round($totalLabour * ($ratio / 100), 2);
                $labourLinesEmitted++;
            }

            if ($labourLinesEmitted === 0 && $mode !== 'dayworks') {
                $total += round($totalLabour, 2);
            }
        }

        // Direct material lines (one per condition cost code)
        $totalMaterial = 0.0;
        foreach ($materialByCostCode as $data) {
            $amount = round($data['total'], 2);
            if ($amount <= 0) {
                continue;
            }
            $totalMaterial += $amount;
            $total += $amount;
        }

        // Material prelim fan-out
        if ($totalMaterial > 0) {
            foreach ($locationCostCodes as $costCode) {
                $ratio = (float) ($costCode->pivot->{$ratioColumn} ?? 0);
                $prelimType = strtoupper(trim($costCode->pivot->prelim_type ?? ''));

                if ($ratio <= 0 || ! str_starts_with($prelimType, 'MAT')) {
                    continue;
                }

                $total += round($totalMaterial * ($ratio / 100), 2);
            }
        }

        return round($total, 2);
    }

    private function findBaseCostCode($costCodes, string $type): string
    {
        $match = $costCodes->first(function ($cc) use ($type) {
            $prelim = strtoupper(trim($cc->pivot->prelim_type ?? ''));

            return $prelim === $type || $prelim === "{$type}_BASE";
        });

        return $match ? $match->code : ($type === 'LAB' ? '01-01' : '42-01');
    }

    private function findBaseCostCodeId($costCodes, string $type): ?int
    {
        $match = $costCodes->first(function ($cc) use ($type) {
            $prelim = strtoupper(trim($cc->pivot->prelim_type ?? ''));

            return $prelim === $type || $prelim === "{$type}_BASE";
        });

        return $match?->id;
    }

    /**
     * Pick a cost code to attach to the consolidated labour fallback line when
     * the location has no LAB cost codes configured for variation_ratio fan-out.
     * Prefers any prelim_type starting with 'LAB' (regardless of variation_ratio),
     * then falls back to the standard wages code 01-01 if present, else null.
     */
    private function findFallbackLabourCostCode($costCodes)
    {
        $labMatch = $costCodes->first(function ($cc) {
            $prelim = strtoupper(trim($cc->pivot->prelim_type ?? ''));

            return str_starts_with($prelim, 'LAB');
        });
        if ($labMatch) {
            return $labMatch;
        }

        return $costCodes->firstWhere('code', '01-01');
    }
}
