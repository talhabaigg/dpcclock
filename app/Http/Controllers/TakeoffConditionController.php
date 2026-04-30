<?php

namespace App\Http\Controllers;

use App\Models\ConditionLineItem;
use App\Models\ConditionType;
use App\Models\CostCode;
use App\Models\LabourCostCode;
use App\Models\Location;
use App\Models\MaterialItem;
use App\Models\TakeoffCondition;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TakeoffConditionController extends Controller
{
    public function index(Location $location)
    {
        $conditions = TakeoffCondition::where('location_id', $location->id)
            ->with([
                'materials.materialItem',
                'payRateTemplate',
                'costCodes.costCode',
                'boqItems.costCode',
                'boqItems.labourCostCode',
                'conditionType',
                'conditionLabourCodes.labourCostCode',
                'lineItems.materialItem',
                'lineItems.labourCostCode',
            ])
            ->orderBy('condition_number')
            ->orderBy('name')
            ->get();

        $this->appendEffectiveUnitCosts($conditions, $location->id);
        $this->appendLineItemEffectiveUnitCosts($conditions, $location->id);

        return response()->json(['conditions' => $conditions]);
    }

    public function store(Request $request, Location $location)
    {
        $validated = $request->validate($this->validationRules(false));

        $pricingMethod = $validated['pricing_method'];

        $condition = TakeoffCondition::create([
            'location_id' => $location->id,
            'condition_type_id' => $validated['condition_type_id'] ?? null,
            'name' => $validated['name'],
            'type' => $validated['type'],
            'color' => $validated['color'],
            'opacity' => $validated['opacity'] ?? 50,
            'description' => $validated['description'] ?? null,
            'height' => $validated['height'] ?? null,
            'thickness' => $validated['thickness'] ?? null,
            'pricing_method' => $pricingMethod,
            'labour_unit_rate' => null, // legacy column, no longer written
            'labour_rate_source' => $pricingMethod === 'build_up' ? ($validated['labour_rate_source'] ?? 'manual') : 'manual',
            'manual_labour_rate' => $pricingMethod === 'build_up' ? ($validated['manual_labour_rate'] ?? null) : null,
            'pay_rate_template_id' => $pricingMethod === 'build_up' ? ($validated['pay_rate_template_id'] ?? null) : null,
            'production_rate' => $pricingMethod === 'build_up' ? ($validated['production_rate'] ?? null) : null,
        ]);

        if ($pricingMethod === 'unit_rate') {
            $this->syncBoqItems($condition, $validated['boq_items'] ?? []);
            $this->syncLabourCodesFromBoqItems($condition);
        }

        if ($pricingMethod === 'build_up' && ! empty($validated['materials'])) {
            foreach ($validated['materials'] as $mat) {
                $condition->materials()->create([
                    'material_item_id' => $mat['material_item_id'],
                    'qty_per_unit' => $mat['qty_per_unit'],
                    'waste_percentage' => $mat['waste_percentage'] ?? 0,
                ]);
            }
        }

        // Standalone Labour Cost Codes payload only applies to build_up.
        // For unit_rate it's auto-synced from boq_items (kind='labour') above.
        // For detailed it's auto-synced from line items in batchLineItems().
        if ($pricingMethod === 'build_up' && ! empty($validated['labour_cost_codes'])) {
            foreach ($validated['labour_cost_codes'] as $lcc) {
                $condition->conditionLabourCodes()->create([
                    'labour_cost_code_id' => $lcc['labour_cost_code_id'],
                    'production_rate' => $lcc['production_rate'] ?? null,
                    'hourly_rate' => $lcc['hourly_rate'] ?? null,
                ]);
            }
        }

        $condition->load($this->withRelations());
        $this->appendEffectiveUnitCosts(collect([$condition]), $location->id);
        $this->appendLineItemEffectiveUnitCosts(collect([$condition]), $location->id);

        return response()->json($condition);
    }

    public function update(Request $request, Location $location, TakeoffCondition $condition)
    {
        if ($condition->location_id !== $location->id) {
            abort(404);
        }

        $validated = $request->validate($this->validationRules(true));

        $materialData = $validated['materials'] ?? null;
        $boqItemData = array_key_exists('boq_items', $validated) ? $validated['boq_items'] : null;
        $labourCostCodeData = $validated['labour_cost_codes'] ?? null;
        unset($validated['materials'], $validated['boq_items'], $validated['labour_cost_codes']);

        $pricingMethod = $validated['pricing_method'] ?? $condition->pricing_method;

        // Clean up irrelevant scalar fields when switching pricing method.
        // labour_unit_rate is legacy and never written; it's only read for backfill.
        if ($pricingMethod === 'unit_rate') {
            $validated['manual_labour_rate'] = null;
            $validated['pay_rate_template_id'] = null;
            $validated['production_rate'] = null;
        } elseif ($pricingMethod === 'detailed') {
            $validated['manual_labour_rate'] = null;
            $validated['pay_rate_template_id'] = null;
            $validated['production_rate'] = null;
        }

        $condition->update($validated);

        if ($pricingMethod === 'unit_rate') {
            // Drop other-method baggage so the condition reads cleanly.
            $condition->materials()->delete();
            $condition->lineItems()->delete();
            $condition->costCodes()->delete(); // legacy table — fully replaced by boq_items

            if ($boqItemData !== null) {
                $this->syncBoqItems($condition, $boqItemData);
                $this->syncLabourCodesFromBoqItems($condition);
            }
        }

        if ($pricingMethod === 'build_up') {
            $condition->boqItems()->delete();
            $condition->costCodes()->delete();
            $condition->lineItems()->delete();

            if ($materialData !== null) {
                $condition->materials()->delete();
                foreach ($materialData as $mat) {
                    $condition->materials()->create([
                        'material_item_id' => $mat['material_item_id'],
                        'qty_per_unit' => $mat['qty_per_unit'],
                        'waste_percentage' => $mat['waste_percentage'] ?? 0,
                    ]);
                }
            }
        }

        if ($pricingMethod === 'detailed') {
            $condition->materials()->delete();
            $condition->costCodes()->delete();
            $condition->boqItems()->delete();
        }

        // Standalone production-tracking LCCs only apply to build_up.
        // unit_rate auto-syncs from boq_items above; detailed auto-syncs in batchLineItems.
        if ($pricingMethod === 'build_up' && $labourCostCodeData !== null) {
            $condition->conditionLabourCodes()->delete();
            foreach ($labourCostCodeData as $lcc) {
                $condition->conditionLabourCodes()->create([
                    'labour_cost_code_id' => $lcc['labour_cost_code_id'],
                    'production_rate' => $lcc['production_rate'] ?? null,
                    'hourly_rate' => $lcc['hourly_rate'] ?? null,
                ]);
            }
        }

        $condition->load($this->withRelations());
        $this->appendEffectiveUnitCosts(collect([$condition]), $location->id);
        $this->appendLineItemEffectiveUnitCosts(collect([$condition]), $location->id);

        return response()->json($condition);
    }

    /**
     * Validation rules shared between store/update.
     * `$partial` makes scalar fields optional for PATCH-style updates.
     */
    private function validationRules(bool $partial): array
    {
        $sometimes = $partial ? 'sometimes|' : '';

        return [
            'name' => $sometimes.'required|string|max:255',
            'type' => $sometimes.'required|string|in:linear,area,count',
            'condition_type_id' => 'nullable|integer|exists:condition_types,id',
            'color' => $sometimes.'required|string|regex:/^#[0-9a-fA-F]{6}$/',
            'opacity' => 'nullable|integer|min:0|max:100',
            'description' => 'nullable|string|max:2000',
            'height' => 'nullable|numeric|min:0.0001|max:100',
            'thickness' => 'nullable|numeric|min:0.0001|max:100',
            'pricing_method' => $sometimes.'required|string|in:unit_rate,build_up,detailed',

            // BoQ items (replaces legacy `cost_codes` + `labour_unit_rate` for unit_rate)
            'boq_items' => 'nullable|array',
            'boq_items.*.kind' => 'required|string|in:labour,material',
            'boq_items.*.cost_code_id' => 'nullable|integer|exists:cost_codes,id',
            'boq_items.*.labour_cost_code_id' => 'nullable|integer|exists:labour_cost_codes,id',
            'boq_items.*.unit_rate' => 'required|numeric|min:0',
            'boq_items.*.production_rate' => 'nullable|numeric|min:0',
            'boq_items.*.notes' => 'nullable|string|max:500',
            'boq_items.*.sort_order' => 'nullable|integer|min:0',

            // Build-Up fields
            'labour_rate_source' => 'sometimes|required|string|in:manual,template',
            'manual_labour_rate' => 'nullable|numeric|min:0',
            'pay_rate_template_id' => 'nullable|integer|exists:location_pay_rate_templates,id',
            'production_rate' => 'nullable|numeric|min:0',
            'materials' => 'nullable|array',
            'materials.*.material_item_id' => 'required|integer|exists:material_items,id',
            'materials.*.qty_per_unit' => 'required|numeric|min:0.0001',
            'materials.*.waste_percentage' => 'nullable|numeric|min:0|max:100',

            // Standalone labour cost codes (build_up production tracking only)
            'labour_cost_codes' => 'nullable|array',
            'labour_cost_codes.*.labour_cost_code_id' => 'required|integer|exists:labour_cost_codes,id',
            'labour_cost_codes.*.production_rate' => 'nullable|numeric|min:0',
            'labour_cost_codes.*.hourly_rate' => 'nullable|numeric|min:0',
        ];
    }

    /**
     * Eager-load list used by index/store/update responses.
     */
    private function withRelations(): array
    {
        return [
            'materials.materialItem',
            'payRateTemplate',
            'costCodes.costCode',
            'boqItems.costCode',
            'boqItems.labourCostCode',
            'conditionType',
            'conditionLabourCodes.labourCostCode',
            'lineItems.materialItem',
            'lineItems.labourCostCode',
        ];
    }

    /**
     * Replace this condition's BoQ items with the provided list. Each item must
     * have `kind` (labour|material) and a `unit_rate`. Labour items reference a
     * `labour_cost_code_id` (nullable for legacy/unmapped); material items
     * reference a `cost_code_id`.
     */
    private function syncBoqItems(TakeoffCondition $condition, array $items): void
    {
        $condition->boqItems()->delete();

        foreach ($items as $idx => $item) {
            $kind = $item['kind'];

            $condition->boqItems()->create([
                'kind' => $kind,
                'cost_code_id' => $kind === 'material' ? ($item['cost_code_id'] ?? null) : null,
                'labour_cost_code_id' => $kind === 'labour' ? ($item['labour_cost_code_id'] ?? null) : null,
                'unit_rate' => $item['unit_rate'],
                'production_rate' => $kind === 'labour' ? ($item['production_rate'] ?? null) : null,
                'notes' => $item['notes'] ?? null,
                'sort_order' => $item['sort_order'] ?? $idx,
            ]);
        }
    }

    /**
     * Mirror BoQ labour items into condition_labour_codes so the existing
     * production-tracking pipeline (ProductionStatusTrait, sync controllers,
     * drawing labour summaries) keeps working unchanged. Skips legacy/unmapped
     * labour rows that haven't been linked to an LCC yet.
     */
    private function syncLabourCodesFromBoqItems(TakeoffCondition $condition): void
    {
        $labourItems = $condition->boqItems()
            ->where('kind', 'labour')
            ->whereNotNull('labour_cost_code_id')
            ->get();

        // De-dupe by labour_cost_code_id (first row wins for production_rate)
        $byLcc = [];
        foreach ($labourItems as $item) {
            $lccId = $item->labour_cost_code_id;
            if (! isset($byLcc[$lccId])) {
                $byLcc[$lccId] = $item;
            }
        }

        $condition->conditionLabourCodes()->delete();
        foreach ($byLcc as $lccId => $item) {
            $condition->conditionLabourCodes()->create([
                'labour_cost_code_id' => $lccId,
                'production_rate' => $item->production_rate,
                'hourly_rate' => null,
            ]);
        }
    }

    public function destroy(Location $location, TakeoffCondition $condition)
    {
        if ($condition->location_id !== $location->id) {
            abort(404);
        }

        $condition->delete();

        return response()->json(['message' => 'Condition deleted.']);
    }

    public function searchMaterials(Request $request, Location $location)
    {
        $query = $request->input('q', '');

        $items = MaterialItem::query()
            ->where(function ($q) use ($query) {
                $q->where('code', 'like', "%{$query}%")
                    ->orWhere('description', 'like', "%{$query}%");
            })
            ->whereNull('deleted_at')
            ->select('id', 'code', 'description', 'unit_cost')
            ->limit(30)
            ->get()
            ->map(function ($item) use ($location) {
                // Check for location-specific pricing
                $pricing = $item->locations()->wherePivot('location_id', $location->id)->first();
                $item->effective_unit_cost = $pricing
                    ? (float) $pricing->pivot->unit_cost_override
                    : (float) $item->unit_cost;

                return $item;
            });

        return response()->json(['items' => $items]);
    }

    public function searchCostCodes(Request $request, Location $location)
    {
        $query = $request->input('q', '');
        // Optional "min,max" filter on the leading numeric segment of the code
        // (e.g. "20,98" matches codes like "44-20" where 20 ≤ 44 ≤ 98).
        // Used by the BoQ material picker to scope to direct-cost codes only.
        $range = $request->input('prefix_range');

        $builder = CostCode::query()
            ->where(function ($q) use ($query) {
                $q->where('code', 'like', "%{$query}%")
                    ->orWhere('description', 'like', "%{$query}%");
            });

        if (is_string($range) && preg_match('/^(\d+),(\d+)$/', $range, $m)) {
            $min = (int) $m[1];
            $max = (int) $m[2];
            $builder->whereRaw(
                "CAST(SUBSTRING_INDEX(code, '-', 1) AS UNSIGNED) BETWEEN ? AND ?",
                [$min, $max]
            );
        }

        $items = $builder->select('id', 'code', 'description')
            ->orderBy('code')
            ->limit(30)
            ->get();

        return response()->json(['items' => $items]);
    }

    /**
     * Stream a CSV export of every BoQ-priced condition in this location, in
     * the exact shape that `bulkImport()` consumes — so estimators can edit
     * the file and re-upload. One row per BoQ item; conditions with no items
     * still emit a single placeholder row (blank kind/code) so the parent
     * shows up and round-trips.
     */
    public function bulkExport(Location $location)
    {
        $conditions = TakeoffCondition::where('location_id', $location->id)
            ->where('pricing_method', 'unit_rate')
            ->with(['boqItems.costCode', 'boqItems.labourCostCode'])
            ->orderBy('condition_number')
            ->orderBy('name')
            ->get();

        $headers = ['condition_id', 'condition_name', 'measurement_type', 'kind', 'code', 'unit_rate', 'production_rate'];
        $filename = 'conditions-' . $location->id . '-' . now()->format('Ymd-His') . '.csv';

        return response()->streamDownload(function () use ($conditions, $headers) {
            $out = fopen('php://output', 'w');
            fputcsv($out, $headers);

            foreach ($conditions as $condition) {
                $items = $condition->boqItems->sortBy('sort_order')->values();
                if ($items->isEmpty()) {
                    fputcsv($out, [$condition->id, $condition->name, $condition->type, '', '', '', '']);
                    continue;
                }
                foreach ($items as $item) {
                    $code = $item->kind === 'labour'
                        ? ($item->labourCostCode->code ?? '')
                        : ($item->costCode->code ?? '');
                    fputcsv($out, [
                        $condition->id,
                        $condition->name,
                        $condition->type,
                        $item->kind,
                        $code,
                        $item->unit_rate,
                        $item->production_rate,
                    ]);
                }
            }

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    /**
     * Bulk import: create one or many BoQ-priced conditions from a flat
     * row list (one BoQ item per row, parent fields repeated). Rows are
     * grouped by `condition_name`; codes are resolved against this
     * location's labour cost codes and the project cost codes table.
     *
     * Skips rows whose code can't be resolved or whose parent name already
     * exists in the location, returning a per-row report so the importer
     * can surface what landed and what didn't.
     */
    public function bulkImport(Request $request, Location $location)
    {
        $validated = $request->validate([
            'rows' => 'required|array|min:1',
            'rows.*.condition_id' => 'nullable|string',
            'rows.*.condition_name' => 'required|string|max:255',
            'rows.*.measurement_type' => 'required|string|in:linear,area,count',
            'rows.*.kind' => 'required|string|in:labour,material',
            'rows.*.code' => 'required|string',
            'rows.*.unit_rate' => 'nullable|string',
            'rows.*.production_rate' => 'nullable|string',
        ]);

        // 1) Group rows. condition_id wins as the grouping key when present
        // (so a rename on round-trip still updates the same record); rows
        // without an ID fall back to grouping by trimmed name.
        $groups = [];
        foreach ($validated['rows'] as $idx => $row) {
            $name = trim($row['condition_name']);
            if ($name === '') continue;

            $rawId = trim((string) ($row['condition_id'] ?? ''));
            $id = ($rawId !== '' && ctype_digit($rawId)) ? (int) $rawId : null;
            $key = $id !== null ? "id:{$id}" : "name:{$name}";

            $groups[$key] ??= [
                'condition_id' => $id,
                'name' => $name,
                'type' => strtolower(trim($row['measurement_type'])),
                'rows' => [],
            ];
            $groups[$key]['rows'][] = ['_idx' => $idx] + $row;
        }

        if (empty($groups)) {
            return response()->json([
                'created' => 0, 'updated' => 0,
                'skipped_existing' => [], 'skipped_invalid_id' => [],
                'unmatched_codes' => [], 'message' => 'No usable rows.',
            ], 422);
        }

        // 2) Resolve provided condition_ids in this location. Anything not
        // found here, in another location, or not BoQ-priced is invalid for
        // upsert and gets skipped with a warning rather than silently
        // converted or accidentally clobbered.
        $providedIds = array_values(array_filter(array_map(fn ($g) => $g['condition_id'], $groups)));
        $existingById = $providedIds
            ? TakeoffCondition::where('location_id', $location->id)
                ->whereIn('id', $providedIds)
                ->where('pricing_method', 'unit_rate')
                ->get()
                ->keyBy('id')
            : collect();

        // 3) For create-only groups (no ID), look up by name to skip dupes.
        $createNames = [];
        foreach ($groups as $g) {
            if ($g['condition_id'] === null) $createNames[] = $g['name'];
        }
        $existingNamesSet = $createNames
            ? array_flip(
                TakeoffCondition::where('location_id', $location->id)
                    ->whereIn('name', $createNames)
                    ->pluck('name')
                    ->all()
            )
            : [];

        // 4) Resolve every code in two queries.
        $labourCodes = [];
        $materialCodes = [];
        foreach ($groups as $g) {
            // Skip rows we already know we won't process.
            if ($g['condition_id'] !== null && ! $existingById->has($g['condition_id'])) continue;
            if ($g['condition_id'] === null && isset($existingNamesSet[$g['name']])) continue;
            foreach ($g['rows'] as $r) {
                $code = trim($r['code']);
                if ($code === '') continue;
                if (strtolower(trim($r['kind'])) === 'labour') $labourCodes[$code] = true;
                else $materialCodes[$code] = true;
            }
        }

        $labourMap = $labourCodes
            ? LabourCostCode::where('location_id', $location->id)
                ->whereIn('code', array_keys($labourCodes))
                ->get()
                ->keyBy('code')
            : collect();

        $materialMap = $materialCodes
            ? CostCode::whereIn('code', array_keys($materialCodes))
                ->select('id', 'code', 'description')
                ->get()
                ->keyBy('code')
            : collect();

        // 5) Run create + update in a single transaction.
        $createdIds = [];
        $updatedIds = [];
        $skippedExisting = [];
        $skippedInvalidId = [];
        $unmatchedCodes = [];

        DB::transaction(function () use (
            $groups, $existingById, $existingNamesSet, $labourMap, $materialMap, $location,
            &$createdIds, &$updatedIds, &$skippedExisting, &$skippedInvalidId, &$unmatchedCodes
        ) {
            foreach ($groups as $g) {
                $providedId = $g['condition_id'];

                // Resolve to an action: update / create / skip.
                if ($providedId !== null) {
                    $condition = $existingById->get($providedId);
                    if (! $condition) {
                        $skippedInvalidId[] = $providedId;
                        continue;
                    }
                } else {
                    if (isset($existingNamesSet[$g['name']])) {
                        $skippedExisting[] = $g['name'];
                        continue;
                    }
                    $condition = TakeoffCondition::create([
                        'location_id' => $location->id,
                        'name' => $g['name'],
                        'type' => in_array($g['type'], ['linear', 'area', 'count'], true) ? $g['type'] : 'linear',
                        'color' => '#3b82f6',
                        'opacity' => 50,
                        'pricing_method' => 'unit_rate',
                        'labour_unit_rate' => null,
                        'labour_rate_source' => 'manual',
                    ]);
                }

                // Build the new BoQ items list for this condition.
                $boqItems = [];
                $sortOrder = 0;
                foreach ($g['rows'] as $r) {
                    $kind = strtolower(trim($r['kind']));
                    $code = trim($r['code']);
                    $unitRate = is_numeric($r['unit_rate'] ?? '') ? (float) $r['unit_rate'] : 0.0;
                    $productionRate = is_numeric($r['production_rate'] ?? '') ? (float) $r['production_rate'] : null;

                    if ($kind === 'labour') {
                        $lcc = $labourMap->get($code);
                        if (! $lcc) { $unmatchedCodes[] = "labour:{$code}"; continue; }
                        $boqItems[] = [
                            'kind' => 'labour',
                            'cost_code_id' => null,
                            'labour_cost_code_id' => $lcc->id,
                            'unit_rate' => $unitRate,
                            'production_rate' => $productionRate ?? $lcc->default_production_rate,
                            'sort_order' => $sortOrder++,
                        ];
                    } else {
                        $cc = $materialMap->get($code);
                        if (! $cc) { $unmatchedCodes[] = "material:{$code}"; continue; }
                        $boqItems[] = [
                            'kind' => 'material',
                            'cost_code_id' => $cc->id,
                            'labour_cost_code_id' => null,
                            'unit_rate' => $unitRate,
                            'production_rate' => null,
                            'sort_order' => $sortOrder++,
                        ];
                    }
                }

                // On update, push parent-field changes from the CSV (name + type).
                // CSV is treated as source of truth on round-trip.
                if ($providedId !== null) {
                    $type = in_array($g['type'], ['linear', 'area', 'count'], true) ? $g['type'] : $condition->type;
                    $condition->update(['name' => $g['name'], 'type' => $type]);
                    $updatedIds[] = $condition->id;
                } else {
                    $createdIds[] = $condition->id;
                }

                // syncBoqItems replaces in place, so it works for both paths.
                $this->syncBoqItems($condition, $boqItems);
                $this->syncLabourCodesFromBoqItems($condition);
            }
        });

        // 6) Reload all conditions so the client gets fresh state.
        $conditions = TakeoffCondition::where('location_id', $location->id)
            ->with($this->withRelations())
            ->orderBy('condition_number')
            ->orderBy('name')
            ->get();
        $this->appendEffectiveUnitCosts($conditions, $location->id);
        $this->appendLineItemEffectiveUnitCosts($conditions, $location->id);

        return response()->json([
            'created' => count($createdIds),
            'updated' => count($updatedIds),
            'skipped_existing' => array_values(array_unique($skippedExisting)),
            'skipped_invalid_id' => array_values(array_unique($skippedInvalidId)),
            'unmatched_codes' => array_values(array_unique($unmatchedCodes)),
            'conditions' => $conditions,
        ]);
    }

    // ---- Condition Type CRUD ----

    public function indexTypes(Location $location)
    {
        $types = ConditionType::where('location_id', $location->id)->orderBy('name')->get();

        return response()->json(['types' => $types]);
    }

    public function storeType(Request $request, Location $location)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
        ]);

        $type = ConditionType::firstOrCreate([
            'location_id' => $location->id,
            'name' => $validated['name'],
        ]);

        return response()->json($type);
    }

    public function destroyType(Location $location, ConditionType $conditionType)
    {
        if ($conditionType->location_id !== $location->id) {
            abort(404);
        }

        $conditionType->delete();

        return response()->json(['message' => 'Condition type deleted.']);
    }

    // ---- Labour Cost Code CRUD ----

    public function indexLabourCostCodes(Location $location)
    {
        $codes = LabourCostCode::where('location_id', $location->id)
            ->ordered()
            ->get();

        return response()->json(['codes' => $codes]);
    }

    public function searchLabourCostCodes(Request $request, Location $location)
    {
        $query = $request->input('q', '');

        $items = LabourCostCode::where('location_id', $location->id)
            ->where(function ($q) use ($query) {
                $q->where('code', 'like', "%{$query}%")
                    ->orWhere('name', 'like', "%{$query}%");
            })
            ->ordered()
            ->limit(30)
            ->get();

        return response()->json(['items' => $items]);
    }

    public function storeLabourCostCode(Request $request, Location $location)
    {
        $validated = $request->validate([
            'code' => 'required|string|max:50',
            'name' => 'required|string|max:255',
            'unit' => 'nullable|string|max:20',
            'default_production_rate' => 'nullable|numeric|min:0',
            'default_hourly_rate' => 'nullable|numeric|min:0',
        ]);

        $lcc = LabourCostCode::create([
            'location_id' => $location->id,
            'code' => $validated['code'],
            'name' => $validated['name'],
            'unit' => $validated['unit'] ?? 'm2',
            'default_production_rate' => $validated['default_production_rate'] ?? null,
            'default_hourly_rate' => $validated['default_hourly_rate'] ?? null,
        ]);

        return response()->json($lcc);
    }

    // ---- Condition Line Items (Detailed mode) ----

    public function indexLineItems(Location $location, TakeoffCondition $condition)
    {
        if ($condition->location_id !== $location->id) {
            abort(404);
        }

        $lineItems = $condition->lineItems()
            ->with(['materialItem', 'labourCostCode'])
            ->get();

        $this->appendLineItemEffectiveUnitCosts(collect([$condition]), $location->id);

        return response()->json(['line_items' => $lineItems]);
    }

    public function batchLineItems(Request $request, Location $location, TakeoffCondition $condition)
    {
        if ($condition->location_id !== $location->id) {
            abort(404);
        }

        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.id' => 'nullable|integer',
            'items.*._delete' => 'nullable|boolean',
            'items.*.sort_order' => 'required|integer|min:0',
            'items.*.section' => 'nullable|string|max:100',
            'items.*.entry_type' => 'required|string|in:material,labour',
            'items.*.material_item_id' => 'nullable|integer|exists:material_items,id',
            'items.*.labour_cost_code_id' => 'nullable|integer|exists:labour_cost_codes,id',
            'items.*.item_code' => 'nullable|string|max:50',
            'items.*.description' => 'nullable|string|max:500',
            'items.*.qty_source' => 'required|string|in:primary,secondary,fixed',
            'items.*.fixed_qty' => 'nullable|numeric|min:0',
            'items.*.oc_spacing' => 'nullable|numeric|min:0',
            'items.*.layers' => 'required|integer|min:1|max:99',
            'items.*.waste_percentage' => 'nullable|numeric|min:0|max:100',
            'items.*.unit_cost' => 'nullable|numeric|min:0',
            'items.*.cost_source' => 'required|string|in:material,manual',
            'items.*.uom' => 'nullable|string|max:20',
            'items.*.pack_size' => 'nullable|numeric|min:0.0001',
            'items.*.hourly_rate' => 'nullable|numeric|min:0',
            'items.*.production_rate' => 'nullable|numeric|min:0',
        ]);

        $existingIds = $condition->lineItems()->pluck('id')->toArray();
        $receivedIds = [];

        foreach ($validated['items'] as $item) {
            $id = $item['id'] ?? null;
            $shouldDelete = $item['_delete'] ?? false;

            if ($id && $shouldDelete) {
                ConditionLineItem::where('id', $id)
                    ->where('takeoff_condition_id', $condition->id)
                    ->delete();

                continue;
            }

            $data = collect($item)->except(['id', '_delete'])->toArray();
            $data['takeoff_condition_id'] = $condition->id;

            if ($id) {
                $lineItem = ConditionLineItem::where('id', $id)
                    ->where('takeoff_condition_id', $condition->id)
                    ->first();

                if ($lineItem) {
                    $lineItem->update($data);
                    $receivedIds[] = $id;
                }
            } else {
                $lineItem = ConditionLineItem::create($data);
                $receivedIds[] = $lineItem->id;
            }
        }

        // Delete any items that were not in the batch (full replacement)
        $toDelete = array_diff($existingIds, $receivedIds);
        if (! empty($toDelete)) {
            ConditionLineItem::whereIn('id', $toDelete)
                ->where('takeoff_condition_id', $condition->id)
                ->delete();
        }

        // Auto-sync condition_labour_codes from labour line items for production tracking
        $this->syncLabourCodesFromLineItems($condition);

        $condition->load(['lineItems.materialItem', 'lineItems.labourCostCode']);
        $this->appendLineItemEffectiveUnitCosts(collect([$condition]), $location->id);

        return response()->json(['line_items' => $condition->lineItems]);
    }

    /**
     * Append effective_unit_cost to each condition material,
     * using location-specific pricing overrides when available.
     */
    private function appendEffectiveUnitCosts($conditions, int $locationId): void
    {
        // Collect all material_item_ids across all conditions
        $materialItemIds = $conditions->flatMap(function ($c) {
            return $c->materials->pluck('material_item_id');
        })->unique()->values()->all();

        if (empty($materialItemIds)) {
            return;
        }

        // Batch-load location-specific pricing
        $overrides = \Illuminate\Support\Facades\DB::table('location_item_pricing')
            ->where('location_id', $locationId)
            ->whereIn('material_item_id', $materialItemIds)
            ->pluck('unit_cost_override', 'material_item_id');

        // Append effective_unit_cost to each material's materialItem
        foreach ($conditions as $condition) {
            foreach ($condition->materials as $mat) {
                $materialItem = $mat->materialItem;
                if (! $materialItem) {
                    continue;
                }
                $materialItem->effective_unit_cost = isset($overrides[$materialItem->id])
                    ? (float) $overrides[$materialItem->id]
                    : (float) $materialItem->unit_cost;
            }
        }
    }

    /**
     * Append effective_unit_cost to each detailed line item's materialItem,
     * using location-specific pricing overrides when available.
     */
    private function appendLineItemEffectiveUnitCosts($conditions, int $locationId): void
    {
        $materialItemIds = $conditions->flatMap(function ($c) {
            return $c->lineItems->where('entry_type', 'material')->pluck('material_item_id')->filter();
        })->unique()->values()->all();

        if (empty($materialItemIds)) {
            return;
        }

        $overrides = \Illuminate\Support\Facades\DB::table('location_item_pricing')
            ->where('location_id', $locationId)
            ->whereIn('material_item_id', $materialItemIds)
            ->pluck('unit_cost_override', 'material_item_id');

        foreach ($conditions as $condition) {
            foreach ($condition->lineItems as $lineItem) {
                $materialItem = $lineItem->materialItem;
                if (! $materialItem) {
                    continue;
                }
                $materialItem->effective_unit_cost = isset($overrides[$materialItem->id])
                    ? (float) $overrides[$materialItem->id]
                    : (float) $materialItem->unit_cost;
            }
        }
    }

    /**
     * Sync condition_labour_codes from labour line items so
     * the production tracking system can see them.
     */
    private function syncLabourCodesFromLineItems(TakeoffCondition $condition): void
    {
        $labourLineItems = $condition->lineItems()
            ->where('entry_type', 'labour')
            ->whereNotNull('labour_cost_code_id')
            ->get();

        // Collect unique LCCs with their rates from line items
        $lccMap = [];
        foreach ($labourLineItems as $line) {
            $lccId = $line->labour_cost_code_id;
            if (! isset($lccMap[$lccId])) {
                $lccMap[$lccId] = [
                    'production_rate' => $line->production_rate,
                    'hourly_rate' => $line->hourly_rate,
                ];
            }
        }

        // Replace condition_labour_codes with the LCCs from line items
        $condition->conditionLabourCodes()->delete();
        foreach ($lccMap as $lccId => $rates) {
            $condition->conditionLabourCodes()->create([
                'labour_cost_code_id' => $lccId,
                'production_rate' => $rates['production_rate'],
                'hourly_rate' => $rates['hourly_rate'],
            ]);
        }
    }
}
