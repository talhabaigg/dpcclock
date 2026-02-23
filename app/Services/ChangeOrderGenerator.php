<?php

namespace App\Services;

use App\Models\Location;
use App\Models\MaterialItem;
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
     * Labour: Quick Gen logic — totalLabour × each LAB cost code's variation_ratio.
     * Material: Actual cost codes from conditions (aggregated), then MAT Quick Gen on total.
     * Manual pricing items contribute labour only; their material is excluded.
     *
     * Wipes existing line items and creates new ones.
     *
     * @return array{line_items: array, summary: array}
     */
    public function generateFromPricingItems(Variation $variation, Location $location): array
    {
        $variation->loadMissing('pricingItems');

        // ── Step 1: Collect costs from pricing items ──
        $totalLabour = 0;
        // materialByCostCode: keyed by cost_code string, value = [cost_code_id, description, total]
        $materialByCostCode = [];

        foreach ($variation->pricingItems as $item) {
            $totalLabour += $item->labour_cost;

            if (! $item->takeoff_condition_id) {
                // Manual item — labour only, material excluded from Premier
                continue;
            }

            // Re-compute condition to get cost code breakdown
            $condition = TakeoffCondition::with([
                'costCodes.costCode',
                'materials.materialItem.costCode',
            ])->find($item->takeoff_condition_id);

            if (! $condition) {
                continue;
            }

            $costs = $this->calculator->compute($condition, (float) $item->qty);

            if ($condition->pricing_method === 'unit_rate') {
                // Unit rate: breakdown has cost_code_id per cost code
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
            } else {
                // Build-up: breakdown has material items with cost_code_id
                foreach ($costs['breakdown']['materials'] ?? [] as $mat) {
                    $code = $mat['cost_code'] ?? null;
                    $costCodeId = $mat['cost_code_id'] ?? null;

                    if (! $code && isset($mat['material_item_id'])) {
                        // Fallback: resolve from MaterialItem if calculator didn't include it
                        $mi = MaterialItem::with('costCode')->find($mat['material_item_id']);
                        $code = $mi?->costCode?->code;
                        $costCodeId = $mi?->cost_code_id;
                    }

                    if (! $code) {
                        continue;
                    }

                    if (! isset($materialByCostCode[$code])) {
                        $materialByCostCode[$code] = [
                            'cost_code_id' => $costCodeId,
                            'description' => $mat['description'] ?? $code,
                            'total' => 0,
                        ];
                    }
                    $materialByCostCode[$code]['total'] += $mat['line_cost'];
                }
            }
        }

        $locationCostCodes = $location->costCodes()
            ->with('costType')
            ->distinct()
            ->get();

        $lineItems = [];
        $lineNumber = 1;

        // ── Step 2: Labour lines (Quick Gen logic) ──
        if ($totalLabour > 0) {
            foreach ($locationCostCodes as $costCode) {
                $variationRatio = (float) ($costCode->pivot->variation_ratio ?? 0);
                $prelimType = strtoupper(trim($costCode->pivot->prelim_type ?? ''));

                if ($variationRatio <= 0 || ! str_starts_with($prelimType, 'LAB')) {
                    continue;
                }

                $lineAmount = round($totalLabour * ($variationRatio / 100), 2);
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

        // ── Step 3: Direct material lines (from conditions) ──
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

        // ── Step 4: Material prelim lines (Quick Gen logic) ──
        if ($totalMaterial > 0) {
            foreach ($locationCostCodes as $costCode) {
                $variationRatio = (float) ($costCode->pivot->variation_ratio ?? 0);
                $prelimType = strtoupper(trim($costCode->pivot->prelim_type ?? ''));

                if ($variationRatio <= 0 || ! str_starts_with($prelimType, 'MAT')) {
                    continue;
                }

                $lineAmount = round($totalMaterial * ($variationRatio / 100), 2);
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
}
