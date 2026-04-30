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

class TakeoffConditionController extends Controller
{
    public function index(Location $location)
    {
        $conditions = TakeoffCondition::where('location_id', $location->id)
            ->with([
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
        ]);

        if ($pricingMethod === 'unit_rate') {
            $this->syncBoqItems($condition, $validated['boq_items'] ?? []);
            $this->syncLabourCodesFromBoqItems($condition);
        }

        // Detailed: line items are saved via batchLineItems(); LCCs auto-sync from there.

        $condition->load($this->withRelations());
        $this->appendLineItemEffectiveUnitCosts(collect([$condition]), $location->id);

        return response()->json($condition);
    }

    public function update(Request $request, Location $location, TakeoffCondition $condition)
    {
        if ($condition->location_id !== $location->id) {
            abort(404);
        }

        $validated = $request->validate($this->validationRules(true));

        $boqItemData = array_key_exists('boq_items', $validated) ? $validated['boq_items'] : null;
        unset($validated['boq_items']);

        $pricingMethod = $validated['pricing_method'] ?? $condition->pricing_method;

        $condition->update($validated);

        if ($pricingMethod === 'unit_rate') {
            $condition->lineItems()->delete();
            $condition->costCodes()->delete(); // legacy table — fully replaced by boq_items

            if ($boqItemData !== null) {
                $this->syncBoqItems($condition, $boqItemData);
                $this->syncLabourCodesFromBoqItems($condition);
            }
        }

        if ($pricingMethod === 'detailed') {
            $condition->costCodes()->delete();
            $condition->boqItems()->delete();
            // Line items + condition_labour_codes are managed via batchLineItems().
        }

        $condition->load($this->withRelations());
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
            'pricing_method' => $sometimes.'required|string|in:unit_rate,detailed',

            // BoQ items (unit_rate)
            'boq_items' => 'nullable|array',
            'boq_items.*.kind' => 'required|string|in:labour,material',
            'boq_items.*.cost_code_id' => 'nullable|integer|exists:cost_codes,id',
            'boq_items.*.labour_cost_code_id' => 'nullable|integer|exists:labour_cost_codes,id',
            'boq_items.*.unit_rate' => 'required|numeric|min:0',
            'boq_items.*.production_rate' => 'nullable|numeric|min:0',
            'boq_items.*.notes' => 'nullable|string|max:500',
            'boq_items.*.sort_order' => 'nullable|integer|min:0',
        ];
    }

    /**
     * Eager-load list used by index/store/update responses.
     */
    private function withRelations(): array
    {
        return [
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
