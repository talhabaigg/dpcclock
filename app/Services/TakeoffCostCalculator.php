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

        return $this->computeDetailed($condition, $measurement);
    }

    /**
     * Compute costs using the Bill of Quantities (unit_rate) method.
     *
     * effective_qty = computed_value * height (if linear+height) or computed_value
     * material_cost = effective_qty * sum(boq_items where kind='material').unit_rate
     * labour_cost   = effective_qty * sum(boq_items where kind='labour').unit_rate
     *
     * The 26-code labour fan-out (direct wages + oncosts) happens at billing time
     * on the variation/quote layer, not here.
     */
    private function computeUnitRate(TakeoffCondition $condition, DrawingMeasurement $measurement): array
    {
        $condition->loadMissing(['boqItems']);

        $qty = $measurement->computed_value ?? 0;
        $effectiveQty = $qty * $condition->unit_rate_multiplier;

        $materialCost = $effectiveQty * $condition->boqUnitRate('material');
        $labourCost = $effectiveQty * $condition->boqUnitRate('labour');

        return [
            'material_cost' => round($materialCost, 2),
            'labour_cost' => round($labourCost, 2),
            'total_cost' => round($materialCost + $labourCost, 2),
        ];
    }

    /**
     * Compute costs using the Detailed (QuickBid-style) method.
     *
     * Each line item calculates its own quantity from the measurement's
     * primary (computed_value) or secondary (perimeter_value) quantity,
     * applying OC spacing, layers, and waste.
     */
    private function computeDetailed(TakeoffCondition $condition, DrawingMeasurement $measurement): array
    {
        $condition->loadMissing('lineItems.materialItem', 'location');
        $locationId = $condition->location_id;
        $masterRate = $condition->location?->master_hourly_rate;
        $totalMat = 0;
        $totalLab = 0;

        foreach ($condition->lineItems as $line) {
            $baseQty = match ($line->qty_source) {
                'secondary' => $measurement->perimeter_value ?? 0,
                'fixed' => $line->fixed_qty ?? 0,
                default => $measurement->computed_value ?? 0, // 'primary'
            };

            if ($baseQty <= 0) {
                continue;
            }

            $ocSpacing = $line->oc_spacing;
            $layers = max(1, $line->layers);

            if ($ocSpacing && $ocSpacing > 0) {
                $lineQty = ($baseQty / $ocSpacing) * $layers;
            } else {
                $lineQty = $baseQty * $layers;
            }

            $effectiveQty = $lineQty * (1 + ($line->waste_percentage ?? 0) / 100);

            if ($line->entry_type === 'material') {
                $unitCost = $line->cost_source === 'manual' || ! $line->materialItem
                    ? ($line->unit_cost ?? 0)
                    : $this->getMaterialUnitCost($line->materialItem, $locationId);

                if ($unitCost > 0) {
                    $matCost = ($line->pack_size && $line->pack_size > 0)
                        ? ceil($effectiveQty / $line->pack_size) * $unitCost
                        : $effectiveQty * $unitCost;

                    $totalMat += $matCost;
                }
            }

            if ($line->entry_type === 'labour') {
                // Master project rate takes precedence; fall back to per-line override (legacy data).
                $hourlyRate = $masterRate ?? $line->hourly_rate ?? 0;
                $productionRate = $line->production_rate ?? 0;

                if ($hourlyRate > 0 && $productionRate > 0) {
                    $hours = $effectiveQty / $productionRate;
                    $totalLab += $hours * $hourlyRate;
                }
            }
        }

        return [
            'material_cost' => round($totalMat, 2),
            'labour_cost' => round($totalLab, 2),
            'total_cost' => round($totalMat + $totalLab, 2),
        ];
    }

    /**
     * Get the unit cost for a material item, checking for location-specific overrides.
     */
    private function getMaterialUnitCost($materialItem, int $locationId): float
    {
        $pivot = $materialItem->locations()->wherePivot('location_id', $locationId)->first();

        if ($pivot && $pivot->pivot->unit_cost_override !== null) {
            return (float) $pivot->pivot->unit_cost_override;
        }

        return (float) $materialItem->unit_cost;
    }
}
