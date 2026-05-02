<?php

namespace App\Http\Controllers;

use App\Models\Drawing;
use App\Models\DrawingMeasurement;
use App\Models\DrawingScaleCalibration;
use App\Models\Variation;
use App\Services\TakeoffCostCalculator;
use App\Support\MeasurementGeometry;
use Illuminate\Http\Request;

class DrawingMeasurementController extends Controller
{
    private const PAPER_SIZES_MM = [
        'A0' => [1189, 841],
        'A1' => [841, 594],
        'A2' => [594, 420],
        'A3' => [420, 297],
        'A4' => [297, 210],
    ];

    private const MM_PER_UNIT = [
        'mm' => 1,
        'cm' => 10,
        'm'  => 1000,
        'in' => 25.4,
        'ft' => 304.8,
    ];

    public function getCalibration(Drawing $drawing)
    {
        return response()->json([
            'calibration' => $drawing->scaleCalibration,
        ]);
    }

    public function calibrate(Request $request, Drawing $drawing)
    {
        $method = $request->input('method', 'manual');

        $rules = [
            'method' => 'required|string|in:manual,preset',
            'unit' => 'required|string|in:mm,cm,m,in,ft',
        ];

        if ($method === 'manual') {
            $rules += [
                'point_a_x' => 'required|numeric|min:0|max:1',
                'point_a_y' => 'required|numeric|min:0|max:1',
                'point_b_x' => 'required|numeric|min:0|max:1',
                'point_b_y' => 'required|numeric|min:0|max:1',
                'real_distance' => 'required|numeric|min:0.001',
            ];
        } else {
            $rules += [
                'paper_size' => 'required|string|in:A0,A1,A2,A3,A4',
                'drawing_scale' => 'required|string',
            ];
        }

        $validated = $request->validate($rules);

        $imgW = $drawing->tiles_width ?: 1;
        $imgH = $drawing->tiles_height ?: 1;

        if ($method === 'manual') {
            $dx = ($validated['point_b_x'] - $validated['point_a_x']) * $imgW;
            $dy = ($validated['point_b_y'] - $validated['point_a_y']) * $imgH;
            $pixelDistance = sqrt($dx * $dx + $dy * $dy);
            $pixelsPerUnit = $pixelDistance / $validated['real_distance'];
        } else {
            $pixelsPerUnit = $this->computePresetPpu(
                $validated['paper_size'],
                $validated['drawing_scale'],
                $imgW,
                $validated['unit']
            );
        }

        $calibration = DrawingScaleCalibration::updateOrCreate(
            ['drawing_id' => $drawing->id],
            [
                'method' => $method,
                'point_a_x' => $validated['point_a_x'] ?? null,
                'point_a_y' => $validated['point_a_y'] ?? null,
                'point_b_x' => $validated['point_b_x'] ?? null,
                'point_b_y' => $validated['point_b_y'] ?? null,
                'real_distance' => $validated['real_distance'] ?? null,
                'paper_size' => $validated['paper_size'] ?? null,
                'drawing_scale' => $validated['drawing_scale'] ?? null,
                'unit' => $validated['unit'],
                'pixels_per_unit' => $pixelsPerUnit,
                'created_by' => auth()->id(),
            ]
        );

        $this->recomputeMeasurements($drawing, $pixelsPerUnit, $validated['unit'], $imgW, $imgH);

        return response()->json([
            'calibration' => $calibration->fresh(),
            'measurements' => $drawing->measurements()
                ->with('deductions')
                ->whereNull('parent_measurement_id')
                ->orderBy('created_at')
                ->get(),
        ]);
    }

    public function deleteCalibration(Drawing $drawing)
    {
        DrawingScaleCalibration::where('drawing_id', $drawing->id)->delete();
        $drawing->measurements()->where('type', '!=', 'count')->update(['computed_value' => null, 'unit' => null]);

        return response()->json(['message' => 'Calibration deleted.']);
    }

    public function index(Drawing $drawing)
    {
        $measurements = $drawing->measurements()
            ->with([
                'variation:id,co_number,description',
                'deductions',
                'bidArea:id,name',
                'condition.conditionLabourCodes.labourCostCode',
                'condition.lineItems.materialItem',
                'condition.costCodes',
            ])
            ->whereNull('parent_measurement_id')
            ->orderBy('created_at')
            ->get();

        // Compute costs live so the in-panel Costs tab stays in sync with the
        // Estimate sub-tab even if the stored cost columns are stale.
        $calculator = new TakeoffCostCalculator;
        foreach ($measurements as $m) {
            if ($m->takeoff_condition_id && $m->condition) {
                $costs = $calculator->compute($m);
                $m->material_cost = $costs['material_cost'];
                $m->labour_cost = $costs['labour_cost'];
                $m->total_cost = $costs['total_cost'];
            }
            foreach ($m->deductions as $d) {
                if ($d->takeoff_condition_id) {
                    // Deductions inherit the parent's condition for cost calc
                    $d->setRelation('condition', $m->condition);
                    $dCosts = $calculator->compute($d);
                    $d->material_cost = $dCosts['material_cost'];
                    $d->labour_cost = $dCosts['labour_cost'];
                    $d->total_cost = $dCosts['total_cost'];
                }
            }
        }

        return response()->json([
            'measurements' => $measurements,
            'calibration' => $drawing->scaleCalibration,
        ]);
    }

    public function store(Request $request, Drawing $drawing)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|string|in:linear,area,count',
            'color' => 'required|string|regex:/^#[0-9a-fA-F]{6}$/',
            'category' => 'nullable|string|max:100',
            'points' => 'required|array|min:1',
            'points.*.x' => 'required|numeric|min:0|max:1',
            'points.*.y' => 'required|numeric|min:0|max:1',
            'points.*.hix' => 'sometimes|numeric',
            'points.*.hiy' => 'sometimes|numeric',
            'points.*.hox' => 'sometimes|numeric',
            'points.*.hoy' => 'sometimes|numeric',
            'takeoff_condition_id' => 'nullable|integer|exists:takeoff_conditions,id',
            'bid_area_id' => 'nullable|integer|exists:bid_areas,id',
            'parent_measurement_id' => 'nullable|integer|exists:drawing_measurements,id',
            'scope' => 'nullable|string|in:takeoff,variation',
            'variation_id' => 'nullable|integer|exists:variations,id',
        ]);

        // Block writes to a variation that's already locked in Premier
        $this->assertVariationEditable($validated['variation_id'] ?? null);

        // Validate parent belongs to same drawing and is top-level (area or linear)
        if (!empty($validated['parent_measurement_id'])) {
            $parent = DrawingMeasurement::where('id', $validated['parent_measurement_id'])
                ->where('drawing_id', $drawing->id)
                ->whereIn('type', ['area', 'linear'])
                ->whereNull('parent_measurement_id')
                ->firstOrFail();
        }

        $computedValue = null;
        $perimeterValue = null;
        $unit = null;

        if ($validated['type'] === 'count') {
            $computedValue = count($validated['points']);
            $unit = 'ea';
        } else {
            $calibration = $drawing->scaleCalibration;
            if ($calibration) {
                $imgW = $drawing->tiles_width ?: 1;
                $imgH = $drawing->tiles_height ?: 1;

                if ($validated['type'] === 'linear') {
                    $computedValue = MeasurementGeometry::polylineLength(
                        $validated['points'], $calibration->pixels_per_unit, $imgW, $imgH
                    );
                    $unit = $calibration->unit;
                } else {
                    $computedValue = MeasurementGeometry::polygonArea(
                        $validated['points'], $calibration->pixels_per_unit, $imgW, $imgH
                    );
                    $perimeterValue = MeasurementGeometry::polygonPerimeter(
                        $validated['points'], $calibration->pixels_per_unit, $imgW, $imgH
                    );
                    $unit = 'sq ' . $calibration->unit;
                }
            }
        }

        $measurement = DrawingMeasurement::create([
            'drawing_id' => $drawing->id,
            'name' => $validated['name'],
            'type' => $validated['type'],
            'color' => $validated['color'],
            'category' => $validated['category'],
            'points' => $validated['points'],
            'computed_value' => $computedValue,
            'perimeter_value' => $perimeterValue,
            'unit' => $unit,
            'takeoff_condition_id' => $validated['takeoff_condition_id'] ?? null,
            'bid_area_id' => $validated['bid_area_id'] ?? null,
            'parent_measurement_id' => $validated['parent_measurement_id'] ?? null,
            'scope' => $validated['scope'] ?? 'takeoff',
            'variation_id' => $validated['variation_id'] ?? null,
        ]);

        // Compute costs if a condition is assigned
        if ($measurement->takeoff_condition_id) {
            $measurement->load('condition');
            $costs = (new TakeoffCostCalculator)->compute($measurement);
            $measurement->update($costs);
            $measurement->refresh();
        }

        $measurement->load(['variation:id,co_number,description', 'deductions']);

        return response()->json($measurement);
    }

    public function update(Request $request, Drawing $drawing, DrawingMeasurement $measurement)
    {
        if ($measurement->drawing_id !== $drawing->id) {
            abort(404);
        }

        // Block edits to measurements on a locked variation
        $this->assertVariationEditable($measurement->variation_id);

        $minPoints = $measurement->type === 'count' ? 1 : 2;
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'color' => 'sometimes|required|string|regex:/^#[0-9a-fA-F]{6}$/',
            'category' => 'nullable|string|max:100',
            'points' => "sometimes|required|array|min:{$minPoints}",
            'points.*.x' => 'required_with:points|numeric|min:0|max:1',
            'points.*.y' => 'required_with:points|numeric|min:0|max:1',
            'points.*.hix' => 'sometimes|numeric',
            'points.*.hiy' => 'sometimes|numeric',
            'points.*.hox' => 'sometimes|numeric',
            'points.*.hoy' => 'sometimes|numeric',
            'takeoff_condition_id' => 'nullable|integer|exists:takeoff_conditions,id',
            'bid_area_id' => 'nullable|integer|exists:bid_areas,id',
        ]);

        if (isset($validated['points'])) {
            if ($measurement->type === 'count') {
                $validated['computed_value'] = count($validated['points']);
                $validated['unit'] = 'ea';
            } else {
                $calibration = $drawing->scaleCalibration;
                if ($calibration) {
                    $imgW = $drawing->tiles_width ?: 1;
                    $imgH = $drawing->tiles_height ?: 1;
                    if ($measurement->type === 'linear') {
                        $validated['computed_value'] = MeasurementGeometry::polylineLength(
                            $validated['points'], $calibration->pixels_per_unit, $imgW, $imgH
                        );
                        $validated['unit'] = $calibration->unit;
                    } else {
                        $validated['computed_value'] = MeasurementGeometry::polygonArea(
                            $validated['points'], $calibration->pixels_per_unit, $imgW, $imgH
                        );
                        $validated['perimeter_value'] = MeasurementGeometry::polygonPerimeter(
                            $validated['points'], $calibration->pixels_per_unit, $imgW, $imgH
                        );
                        $validated['unit'] = 'sq ' . $calibration->unit;
                    }
                }
            }
        }

        $measurement->update($validated);

        // Recompute costs if condition or points changed
        $conditionId = $measurement->takeoff_condition_id;
        if ($conditionId) {
            $measurement->load('condition');
            $costs = (new TakeoffCostCalculator)->compute($measurement);
            $measurement->update($costs);
        } else {
            // Clear costs if no condition
            $measurement->update(['material_cost' => null, 'labour_cost' => null, 'total_cost' => null]);
        }

        return response()->json($measurement->fresh()->load('deductions'));
    }

    public function destroy(Drawing $drawing, DrawingMeasurement $measurement)
    {
        if ($measurement->drawing_id !== $drawing->id) {
            abort(404);
        }

        // Block deletes on a locked variation
        $this->assertVariationEditable($measurement->variation_id);

        $measurement->load('variation:id,co_number,description');
        $data = $measurement->toArray();
        $measurement->delete();

        return response()->json(['message' => 'Measurement deleted.', 'measurement' => $data]);
    }

    public function restore(Drawing $drawing, int $measurement)
    {
        $m = DrawingMeasurement::withTrashed()
            ->where('drawing_id', $drawing->id)
            ->where('id', $measurement)
            ->firstOrFail();

        $m->restore();
        $m->load(['variation:id,co_number,description', 'deductions']);

        return response()->json($m);
    }

    public function recalculateCosts(Drawing $drawing)
    {
        $calculator = new TakeoffCostCalculator;

        $drawing->measurements()
            ->whereNotNull('takeoff_condition_id')
            ->with(['condition.materials.materialItem', 'condition.costCodes'])
            ->chunk(100, function ($measurements) use ($calculator) {
                foreach ($measurements as $m) {
                    $costs = $calculator->compute($m);
                    $m->update($costs);
                }
            });

        return response()->json([
            'measurements' => $drawing->measurements()
                ->with('deductions')
                ->whereNull('parent_measurement_id')
                ->orderBy('created_at')
                ->get(),
        ]);
    }

    /**
     * Variations already pushed to Premier (premier_co_id set) are immutable —
     * aborts with 423 (Locked) if a write is attempted on one.
     */
    private function assertVariationEditable(?int $variationId): void
    {
        if (! $variationId) {
            return;
        }
        $v = Variation::find($variationId);
        if ($v && $v->premier_co_id) {
            abort(423, 'Variation is locked in Premier and cannot be modified.');
        }
    }

    // ---- Private computation helpers ----

    private function recomputeMeasurements(Drawing $drawing, float $ppu, string $baseUnit, int $imgW, int $imgH): void
    {
        $drawing->measurements()->chunk(100, function ($measurements) use ($ppu, $baseUnit, $imgW, $imgH) {
            foreach ($measurements as $m) {
                if ($m->type === 'count') {
                    continue;
                } elseif ($m->type === 'linear') {
                    $m->computed_value = MeasurementGeometry::polylineLength($m->points, $ppu, $imgW, $imgH);
                    $m->unit = $baseUnit;
                } else {
                    $m->computed_value = MeasurementGeometry::polygonArea($m->points, $ppu, $imgW, $imgH);
                    $m->perimeter_value = MeasurementGeometry::polygonPerimeter($m->points, $ppu, $imgW, $imgH);
                    $m->unit = 'sq ' . $baseUnit;
                }
                $m->save();
            }
        });
    }

    private function computePresetPpu(string $paperSize, string $drawingScale, int $imageWidthPx, string $unit): float
    {
        $paperDims = self::PAPER_SIZES_MM[$paperSize];
        // Use the larger dimension (landscape orientation is standard for construction drawings)
        $paperWidthMm = max($paperDims[0], $paperDims[1]);

        // Parse scale denominator from "1:50" format
        $scaleDenominator = 1;
        if (preg_match('/^1:(\d+(?:\.\d+)?)$/', $drawingScale, $matches)) {
            $scaleDenominator = (float) $matches[1];
        }

        // pixels per mm on paper
        $pixelsPerPaperMm = $imageWidthPx / $paperWidthMm;

        // 1 mm on paper = scaleDenominator mm in real world
        // pixels per real mm = pixelsPerPaperMm / scaleDenominator
        $pixelsPerRealMm = $pixelsPerPaperMm / $scaleDenominator;

        // Convert to target unit
        $mmPerUnit = self::MM_PER_UNIT[$unit] ?? 1;

        return $pixelsPerRealMm * $mmPerUnit;
    }
}
