<?php

namespace App\Services;

use App\Models\DrawingMeasurement;
use App\Models\TakeoffCondition;

class TakeoffCostCalculator
{
    /**
     * Compute costs for a measurement based on its assigned condition.
     *
     * @return array{material_cost: float, labour_cost: float, total_cost: float}
     */
    public function compute(DrawingMeasurement $measurement): array
    {
        $condition = $measurement->condition;

        if (! $condition || $measurement->computed_value === null) {
            return ['material_cost' => 0, 'labour_cost' => 0, 'total_cost' => 0];
        }

        if ($condition->pricing_method === 'unit_rate') {
            return $this->computeUnitRate($condition, $measurement);
        }

        $materialCost = $this->computeMaterialCost($condition, $measurement);
        $labourCost = $this->computeLabourCost($condition, $measurement);

        return [
            'material_cost' => round($materialCost, 2),
            'labour_cost' => round($labourCost, 2),
            'total_cost' => round($materialCost + $labourCost, 2),
        ];
    }

    /**
     * Compute costs using the Unit Rate method.
     *
     * effective_qty = computed_value * height (if linear) or computed_value
     * material_cost = effective_qty * sum(cost_code unit_rates)
     * labour_cost   = effective_qty * labour_unit_rate
     */
    private function computeUnitRate(TakeoffCondition $condition, DrawingMeasurement $measurement): array
    {
        $condition->loadMissing('costCodes');

        $effectiveQty = $measurement->computed_value * $condition->unit_rate_multiplier;

        $totalCostCodeRate = $condition->costCodes->sum('unit_rate');

        $materialCost = $effectiveQty * $totalCostCodeRate;
        $labourCost = $effectiveQty * ($condition->labour_unit_rate ?? 0);

        return [
            'material_cost' => round($materialCost, 2),
            'labour_cost' => round($labourCost, 2),
            'total_cost' => round($materialCost + $labourCost, 2),
        ];
    }

    /**
     * Compute material cost for a measurement.
     *
     * For each material line:
     *   effective_qty = qty_per_unit * (1 + waste_percentage/100) * computed_value
     *   line_cost = effective_qty * unit_cost
     */
    private function computeMaterialCost(TakeoffCondition $condition, DrawingMeasurement $measurement): float
    {
        $condition->loadMissing('materials.materialItem');
        $locationId = $condition->location_id;
        $totalCost = 0;

        foreach ($condition->materials as $line) {
            $materialItem = $line->materialItem;
            if (! $materialItem) {
                continue;
            }

            // Get location-specific pricing override, or fall back to base unit_cost
            $unitCost = $this->getMaterialUnitCost($materialItem, $locationId);

            $effectiveQty = $line->qty_per_unit * (1 + $line->waste_percentage / 100) * $measurement->computed_value;
            $totalCost += $effectiveQty * $unitCost;
        }

        return $totalCost;
    }

    /**
     * Compute labour cost for a measurement.
     *
     * labour_cost = (computed_value / production_rate) * effective_labour_rate
     */
    private function computeLabourCost(TakeoffCondition $condition, DrawingMeasurement $measurement): float
    {
        $productionRate = $condition->production_rate;
        if (! $productionRate || $productionRate <= 0) {
            return 0;
        }

        $effectiveRate = $condition->effective_labour_rate;
        if (! $effectiveRate || $effectiveRate <= 0) {
            return 0;
        }

        $hours = $measurement->computed_value / $productionRate;

        return $hours * $effectiveRate;
    }

    /**
     * Get the unit cost for a material item, checking for location-specific overrides.
     */
    private function getMaterialUnitCost($materialItem, int $locationId): float
    {
        // Check for location-specific pricing via the pivot
        $pivot = $materialItem->locations()->wherePivot('location_id', $locationId)->first();

        if ($pivot && $pivot->pivot->unit_cost_override !== null) {
            return (float) $pivot->pivot->unit_cost_override;
        }

        return (float) $materialItem->unit_cost;
    }
}
