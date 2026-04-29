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
     * Bill of Quantities (unit_rate) method:
     * - effective_qty = qty * height (if linear) or qty
     * - labour_base   = effective_qty * sum(boq_items where kind='labour').unit_rate
     * - material_base = effective_qty * sum(boq_items where kind='material').unit_rate
     */
    private function computeUnitRate(TakeoffCondition $condition, float $qty): array
    {
        $condition->loadMissing(['boqItems.costCode', 'boqItems.labourCostCode']);

        $effectiveQty = $qty * $condition->unit_rate_multiplier;

        $labourBase = 0;
        $materialBase = 0;
        $materialBreakdown = [];
        $labourBreakdown = [];
        $labourTotalRate = 0;

        foreach ($condition->boqItems as $item) {
            $rate = (float) ($item->unit_rate ?? 0);
            $lineCost = $effectiveQty * $rate;

            if ($item->kind === 'material') {
                $materialBase += $lineCost;
                $materialBreakdown[] = [
                    'cost_code_id' => $item->cost_code_id,
                    'cost_code' => $item->costCode?->code,
                    'description' => $item->costCode?->description,
                    'unit_rate' => $rate,
                    'line_cost' => round($lineCost, 2),
                ];
            } elseif ($item->kind === 'labour') {
                $labourBase += $lineCost;
                $labourTotalRate += $rate;
                $labourBreakdown[] = [
                    'labour_cost_code_id' => $item->labour_cost_code_id,
                    'code' => $item->labourCostCode?->code,
                    'name' => $item->labourCostCode?->name,
                    'unit_rate' => $rate,
                    'production_rate' => $item->production_rate !== null ? (float) $item->production_rate : null,
                    'line_cost' => round($lineCost, 2),
                    'legacy_unmapped' => $item->labour_cost_code_id === null,
                ];
            }
        }

        return [
            'labour_base' => round($labourBase, 2),
            'material_base' => round($materialBase, 2),
            'total_cost' => round($labourBase + $materialBase, 2),
            'effective_qty' => $effectiveQty,
            'breakdown' => [
                'method' => 'unit_rate',
                'labour_unit_rate' => round($labourTotalRate, 4),
                'labour_items' => $labourBreakdown,
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
