<?php

namespace App\Services;

use App\Models\TakeoffCondition;

class VariationCostCalculator
{
    /**
     * Compute base labour and material costs for a condition at a given quantity.
     *
     * @return array{labour_base: float, material_base: float, total_cost: float, breakdown: array}
     */
    public function compute(TakeoffCondition $condition, float $qty): array
    {
        if ($condition->pricing_method === 'unit_rate') {
            return $this->computeUnitRate($condition, $qty);
        }

        return $this->computeBuildUp($condition, $qty);
    }

    /**
     * Unit Rate method:
     * - effective_qty = qty * height (if linear) or qty
     * - labour_base = effective_qty * labour_unit_rate
     * - material_base = effective_qty * sum(cost_code unit_rates)
     */
    private function computeUnitRate(TakeoffCondition $condition, float $qty): array
    {
        $condition->loadMissing('costCodes.costCode');

        $effectiveQty = $qty * $condition->unit_rate_multiplier;
        $labourBase = $effectiveQty * ($condition->labour_unit_rate ?? 0);

        $materialBreakdown = [];
        $materialBase = 0;
        foreach ($condition->costCodes as $cc) {
            $lineCost = $effectiveQty * ($cc->unit_rate ?? 0);
            $materialBase += $lineCost;
            $materialBreakdown[] = [
                'cost_code_id' => $cc->cost_code_id,
                'cost_code' => $cc->costCode?->code,
                'description' => $cc->costCode?->description,
                'unit_rate' => (float) $cc->unit_rate,
                'line_cost' => round($lineCost, 2),
            ];
        }

        return [
            'labour_base' => round($labourBase, 2),
            'material_base' => round($materialBase, 2),
            'total_cost' => round($labourBase + $materialBase, 2),
            'effective_qty' => $effectiveQty,
            'breakdown' => [
                'method' => 'unit_rate',
                'labour_unit_rate' => (float) ($condition->labour_unit_rate ?? 0),
                'cost_codes' => $materialBreakdown,
            ],
        ];
    }

    /**
     * Build-Up method:
     * - labour_base = (qty / production_rate) * effective_labour_rate
     * - material_base = sum of material costs (qty_per_unit * waste * unit_cost) * qty
     */
    private function computeBuildUp(TakeoffCondition $condition, float $qty): array
    {
        $condition->loadMissing('materials.materialItem.costCode');

        // Labour
        $labourBase = 0;
        $productionRate = $condition->production_rate;
        $effectiveRate = $condition->effective_labour_rate;

        if ($productionRate && $productionRate > 0 && $effectiveRate && $effectiveRate > 0) {
            $hours = $qty / $productionRate;
            $labourBase = $hours * $effectiveRate;
        }

        // Materials
        $materialBreakdown = [];
        $materialBase = 0;
        $locationId = $condition->location_id;

        foreach ($condition->materials as $line) {
            $materialItem = $line->materialItem;
            if (! $materialItem) {
                continue;
            }

            $unitCost = $this->getMaterialUnitCost($materialItem, $locationId);
            $effectiveQtyPerUnit = $line->qty_per_unit * (1 + ($line->waste_percentage ?? 0) / 100);
            $lineCost = $effectiveQtyPerUnit * $unitCost * $qty;

            $materialBase += $lineCost;
            $materialBreakdown[] = [
                'material_item_id' => $materialItem->id,
                'cost_code_id' => $materialItem->cost_code_id,
                'cost_code' => $materialItem->costCode?->code,
                'code' => $materialItem->code,
                'description' => $materialItem->costCode?->description ?? $materialItem->description,
                'qty_per_unit' => (float) $line->qty_per_unit,
                'waste_percentage' => (float) ($line->waste_percentage ?? 0),
                'unit_cost' => $unitCost,
                'line_cost' => round($lineCost, 2),
            ];
        }

        return [
            'labour_base' => round($labourBase, 2),
            'material_base' => round($materialBase, 2),
            'total_cost' => round($labourBase + $materialBase, 2),
            'effective_qty' => $qty,
            'breakdown' => [
                'method' => 'build_up',
                'production_rate' => (float) ($productionRate ?? 0),
                'effective_labour_rate' => (float) ($effectiveRate ?? 0),
                'hours' => $productionRate > 0 ? round($qty / $productionRate, 4) : 0,
                'materials' => $materialBreakdown,
            ],
        ];
    }

    private function getMaterialUnitCost($materialItem, int $locationId): float
    {
        $pivot = $materialItem->locations()->wherePivot('location_id', $locationId)->first();

        if ($pivot && $pivot->pivot->unit_cost_override !== null) {
            return (float) $pivot->pivot->unit_cost_override;
        }

        return (float) $materialItem->unit_cost;
    }
}
