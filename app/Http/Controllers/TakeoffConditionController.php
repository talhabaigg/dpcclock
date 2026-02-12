<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\MaterialItem;
use App\Models\TakeoffCondition;
use Illuminate\Http\Request;

class TakeoffConditionController extends Controller
{
    public function index(Location $location)
    {
        $conditions = TakeoffCondition::where('location_id', $location->id)
            ->with(['materials.materialItem', 'payRateTemplate'])
            ->orderBy('type')
            ->orderBy('name')
            ->get();

        $this->appendEffectiveUnitCosts($conditions, $location->id);

        return response()->json(['conditions' => $conditions]);
    }

    public function store(Request $request, Location $location)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|string|in:linear,area,count',
            'color' => 'required|string|regex:/^#[0-9a-fA-F]{6}$/',
            'description' => 'nullable|string|max:2000',
            'labour_rate_source' => 'required|string|in:manual,template',
            'manual_labour_rate' => 'nullable|numeric|min:0',
            'pay_rate_template_id' => 'nullable|integer|exists:location_pay_rate_templates,id',
            'production_rate' => 'nullable|numeric|min:0',
            'materials' => 'nullable|array',
            'materials.*.material_item_id' => 'required|integer|exists:material_items,id',
            'materials.*.qty_per_unit' => 'required|numeric|min:0.0001',
            'materials.*.waste_percentage' => 'nullable|numeric|min:0|max:100',
        ]);

        $condition = TakeoffCondition::create([
            'location_id' => $location->id,
            'name' => $validated['name'],
            'type' => $validated['type'],
            'color' => $validated['color'],
            'description' => $validated['description'] ?? null,
            'labour_rate_source' => $validated['labour_rate_source'],
            'manual_labour_rate' => $validated['manual_labour_rate'] ?? null,
            'pay_rate_template_id' => $validated['pay_rate_template_id'] ?? null,
            'production_rate' => $validated['production_rate'] ?? null,
        ]);

        if (! empty($validated['materials'])) {
            foreach ($validated['materials'] as $mat) {
                $condition->materials()->create([
                    'material_item_id' => $mat['material_item_id'],
                    'qty_per_unit' => $mat['qty_per_unit'],
                    'waste_percentage' => $mat['waste_percentage'] ?? 0,
                ]);
            }
        }

        $condition->load(['materials.materialItem', 'payRateTemplate']);
        $this->appendEffectiveUnitCosts(collect([$condition]), $location->id);

        return response()->json($condition);
    }

    public function update(Request $request, Location $location, TakeoffCondition $condition)
    {
        if ($condition->location_id !== $location->id) {
            abort(404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'color' => 'sometimes|required|string|regex:/^#[0-9a-fA-F]{6}$/',
            'description' => 'nullable|string|max:2000',
            'labour_rate_source' => 'sometimes|required|string|in:manual,template',
            'manual_labour_rate' => 'nullable|numeric|min:0',
            'pay_rate_template_id' => 'nullable|integer|exists:location_pay_rate_templates,id',
            'production_rate' => 'nullable|numeric|min:0',
            'materials' => 'nullable|array',
            'materials.*.material_item_id' => 'required|integer|exists:material_items,id',
            'materials.*.qty_per_unit' => 'required|numeric|min:0.0001',
            'materials.*.waste_percentage' => 'nullable|numeric|min:0|max:100',
        ]);

        $materialData = $validated['materials'] ?? null;
        unset($validated['materials']);

        $condition->update($validated);

        if ($materialData !== null) {
            // Sync materials: delete existing and recreate
            $condition->materials()->delete();
            foreach ($materialData as $mat) {
                $condition->materials()->create([
                    'material_item_id' => $mat['material_item_id'],
                    'qty_per_unit' => $mat['qty_per_unit'],
                    'waste_percentage' => $mat['waste_percentage'] ?? 0,
                ]);
            }
        }

        $condition->load(['materials.materialItem', 'payRateTemplate']);
        $this->appendEffectiveUnitCosts(collect([$condition]), $location->id);

        return response()->json($condition);
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
}
