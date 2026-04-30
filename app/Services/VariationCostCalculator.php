<?php

namespace App\Services;

use App\Models\TakeoffCondition;
use RuntimeException;

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

        if ($condition->pricing_method === 'detailed') {
            return $this->computeDetailed($condition, $qty);
        }

        throw new RuntimeException("Unsupported pricing method: {$condition->pricing_method}");
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
     * Detailed pricing for variations: not yet implemented.
     *
     * Mirror TakeoffCostCalculator::computeDetailed() but driven by a synthetic
     * qty pair rather than a measurement. Until that lands, variations cannot
     * price detailed conditions.
     */
    private function computeDetailed(TakeoffCondition $condition, float $qty): array
    {
        throw new RuntimeException('Variation pricing for detailed conditions is not yet implemented.');
    }
}
