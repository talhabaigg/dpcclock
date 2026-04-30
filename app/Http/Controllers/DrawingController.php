<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\ProductionStatusTrait;
use App\Jobs\ProcessDrawingJob;
use App\Models\BidArea;
use App\Models\BudgetHoursEntry;
use App\Models\Drawing;
use App\Models\DrawingMeasurement;
use App\Models\Location;
use App\Models\MeasurementSegmentStatus;
use App\Models\MeasurementStatus;
use App\Models\TakeoffCondition;
use App\Models\Variation;
use App\Services\TakeoffCostCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class DrawingController extends Controller
{
    use ProductionStatusTrait;
    /**
     * List active drawings for a project, grouped by sheet_number.
     */
    public function index(Request $request, Location $project): Response
    {
        // Pre-compute revision counts per sheet_number in a single query
        $revisionCounts = Drawing::where('project_id', $project->id)
            ->whereNotNull('sheet_number')
            ->selectRaw('sheet_number, COUNT(*) as total')
            ->groupBy('sheet_number')
            ->pluck('total', 'sheet_number');

        $drawings = Drawing::where('project_id', $project->id)
            ->where('status', Drawing::STATUS_ACTIVE)
            ->with('media')
            ->select([
                'id', 'project_id', 'sheet_number', 'title',
                'revision_number', 'status', 'created_at',
            ])
            ->withCount(['measurements as takeoff_count' => function ($q) {
                $q->where('scope', 'takeoff');
            }])
            ->orderBy('sheet_number')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($drawing) use ($revisionCounts) {
                return [
                    'id' => $drawing->id,
                    'sheet_number' => $drawing->sheet_number,
                    'title' => $drawing->title,
                    'display_name' => $drawing->display_name,
                    'revision_number' => $drawing->revision_number,
                    'status' => $drawing->status,
                    'created_at' => $drawing->created_at,
                    'thumbnail_url' => $drawing->thumbnail_url,
                    'takeoff_count' => $drawing->takeoff_count,
                    'revision_count' => $drawing->sheet_number
                        ? ($revisionCounts[$drawing->sheet_number] ?? 1)
                        : 1,
                ];
            });

        return Inertia::render('projects/drawings/index', [
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
            ],
            'drawings' => $drawings,
        ]);
    }

    /**
     * Show the drawing upload page.
     */
    public function upload(Location $project): Response
    {
        $recentDrawings = Drawing::where('project_id', $project->id)
            ->whereIn('status', [Drawing::STATUS_DRAFT, Drawing::STATUS_PROCESSING, Drawing::STATUS_PENDING_REVIEW, Drawing::STATUS_ACTIVE])
            ->with('media')
            ->select([
                'id', 'project_id', 'sheet_number', 'title',
                'revision_number', 'status', 'tiles_status', 'created_at',
            ])
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        return Inertia::render('projects/drawings/upload', [
            'project' => ['id' => $project->id, 'name' => $project->name],
            'recentDrawings' => $recentDrawings,
        ]);
    }

    /**
     * Upload one or more single-page drawing files.
     */
    public function store(Request $request, Location $project)
    {
        $validated = $request->validate([
            'files' => 'required|array|min:1',
            'files.*' => 'required|file|max:51200', // 50MB max each
            'sheet_number' => 'sometimes|string|max:100',
            'title' => 'sometimes|string|max:500',
            'revision_number' => 'sometimes|string|max:20',
        ]);

        $createdDrawings = [];

        try {
            DB::transaction(function () use ($request, $project, $validated, &$createdDrawings) {
                foreach ($request->file('files') as $file) {
                    $fileName = $file->getClientOriginalName();
                    $title = $validated['title'] ?? $fileName;

                    $drawing = Drawing::create([
                        'project_id' => $project->id,
                        'sheet_number' => $validated['sheet_number'] ?? null,
                        'title' => $title,
                        'revision_number' => $validated['revision_number'] ?? null,
                        'status' => Drawing::STATUS_DRAFT,
                    ]);

                    $drawing->addMedia($file->getRealPath())
                        ->usingFileName($fileName)
                        ->usingName($title)
                        ->toMediaCollection('source');

                    if (! empty($validated['sheet_number'])) {
                        Drawing::addRevision(
                            $project->id,
                            $validated['sheet_number'],
                            $drawing,
                            $validated['revision_number'] ?? null
                        );
                    }

                    $createdDrawings[] = $drawing;
                }
            });

            // Dispatch tile generation (media conversions are queued by Spatie)
            foreach ($createdDrawings as $drawing) {
                ProcessDrawingJob::dispatch($drawing->id);
            }

            $count = count($createdDrawings);
            $message = $count === 1
                ? 'Drawing uploaded successfully. Processing in background...'
                : "{$count} drawings uploaded successfully. Processing in background...";

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => true,
                    'message' => $message,
                    'drawings' => $createdDrawings,
                ]);
            }

            return redirect()->back()->with('success', $message);
        } catch (\Exception $e) {
            Log::error('Drawing upload error', ['error' => $e->getMessage()]);

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to upload: '.$e->getMessage(),
                ], 500);
            }

            return redirect()->back()->with('error', 'Failed to upload: '.$e->getMessage());
        }
    }

    /**
     * Display a single drawing with observations and revision history.
     */
    public function show(Drawing $drawing): Response
    {
        return $this->takeoff($drawing);
    }

    /**
     * Takeoff workspace — measuring and conditions on a drawing.
     */
    public function takeoff(Drawing $drawing): Response
    {
        [$drawing, $revisions, $projectDrawings] = $this->loadDrawingWithRevisions($drawing);

        return Inertia::render('drawings/takeoff', [
            'drawing' => $drawing,
            'revisions' => $revisions,
            'project' => $drawing->project,
            'activeTab' => 'takeoff',
            'projectDrawings' => $projectDrawings,
        ]);
    }

    /**
     * Condition summary — project-level condition table across all drawings.
     */
    public function conditions(Drawing $drawing): Response
    {
        [$drawing, $revisions, $projectDrawings] = $this->loadDrawingWithRevisions($drawing);
        $project = $drawing->project;

        $conditions = TakeoffCondition::where('location_id', $project->id)
            ->with([
                'conditionType',
                'lineItems.materialItem',
                'materials.materialItem',
                'costCodes',
                'boqItems.costCode',
                'boqItems.labourCostCode',
                'conditionLabourCodes.labourCostCode',
            ])
            ->orderBy('condition_number')
            ->orderBy('name')
            ->get();

        // Aggregate base-bid measurements (excludes variation change-orders)
        $measurements = DrawingMeasurement::whereHas('drawing', fn ($q) => $q->where('project_id', $project->id))
            ->where('scope', 'takeoff')
            ->whereNotNull('takeoff_condition_id')
            ->whereNull('parent_measurement_id')
            ->with(['bidArea:id,name', 'deductions', 'drawing:id'])
            ->get();

        // Compute costs live so the conditions tab matches Labour/Estimate,
        // even if the stored cost columns on measurements are stale.
        $calculator = new TakeoffCostCalculator;

        $conditionSummaries = [];

        foreach ($measurements->groupBy('takeoff_condition_id') as $conditionId => $condMeasurements) {
            $condition = $conditions->firstWhere('id', $conditionId);
            if (! $condition) {
                continue;
            }

            $netQty = 0;
            $materialCost = 0;
            $labourCost = 0;
            $totalCost = 0;
            $areaNames = [];

            foreach ($condMeasurements as $m) {
                $netQty += $m->computed_value ?? 0;

                $m->setRelation('condition', $condition);
                $costs = $calculator->compute($m);
                $materialCost += $costs['material_cost'];
                $labourCost += $costs['labour_cost'];
                $totalCost += $costs['total_cost'];

                foreach ($m->deductions as $d) {
                    $netQty -= $d->computed_value ?? 0;
                    $d->setRelation('condition', $condition);
                    $dCosts = $calculator->compute($d);
                    $materialCost -= $dCosts['material_cost'];
                    $labourCost -= $dCosts['labour_cost'];
                    $totalCost -= $dCosts['total_cost'];
                }

                if ($m->bidArea) {
                    $areaNames[] = $m->bidArea->name;
                }
            }

            $unit = match ($condition->type) {
                'linear' => 'lm',
                'area' => 'm²',
                'count' => 'ea',
                default => 'm',
            };

            $uniqueAreas = array_values(array_unique($areaNames));

            $conditionSummaries[] = [
                'condition_id' => (int) $conditionId,
                'condition_number' => $condition->condition_number,
                'condition_name' => $condition->name,
                'condition_type' => $condition->conditionType?->name ?? 'Uncategorized',
                'type' => $condition->type,
                'pricing_method' => $condition->pricing_method,
                'color' => $condition->color,
                'height' => $condition->height,
                'areas' => $uniqueAreas,
                'qty' => round($netQty, 2),
                'unit' => $unit,
                'unit_price' => $netQty > 0 ? round($totalCost / $netQty, 2) : 0,
                'material_cost' => round($materialCost, 2),
                'labour_cost' => round($labourCost, 2),
                'total_cost' => round($totalCost, 2),
                'line_items' => $condition->pricing_method === 'detailed'
                    ? $condition->lineItems->map(fn ($li) => [
                        'entry_type' => $li->entry_type,
                        'qty_source' => $li->qty_source,
                        'fixed_qty' => $li->fixed_qty,
                        'oc_spacing' => $li->oc_spacing,
                        'layers' => $li->layers,
                        'waste_percentage' => $li->waste_percentage,
                        'unit_cost' => $li->unit_cost,
                        'pack_size' => $li->pack_size,
                        'hourly_rate' => $li->hourly_rate,
                        'production_rate' => $li->production_rate,
                    ])->all()
                    : null,
            ];
        }

        // Sort by condition number
        usort($conditionSummaries, fn ($a, $b) => ($a['condition_number'] ?? 0) <=> ($b['condition_number'] ?? 0));

        return Inertia::render('drawings/conditions', [
            'drawing' => $drawing,
            'revisions' => $revisions,
            'project' => $drawing->project,
            'activeTab' => 'conditions',
            'projectDrawings' => $projectDrawings,
            'conditionSummaries' => $conditionSummaries,
        ]);
    }

    /**
     * Labour summary — project-level labour cost codes across all drawings.
     *
     * One row per condition × LCC pair (not aggregated by LCC), since
     * different conditions can use the same LCC at different rates.
     */
    public function labour(Drawing $drawing): Response
    {
        [$drawing, $revisions, $projectDrawings] = $this->loadDrawingWithRevisions($drawing);
        $project = $drawing->project;

        $conditions = TakeoffCondition::where('location_id', $project->id)
            ->with([
                'conditionLabourCodes.labourCostCode',
                'boqItems.labourCostCode',
                'lineItems' => fn ($q) => $q->where('entry_type', 'labour'),
                'lineItems.labourCostCode',
            ])
            ->get();

        // Aggregate base-bid measurements (excludes variation change-orders)
        $measurements = DrawingMeasurement::whereHas('drawing', fn ($q) => $q->where('project_id', $project->id))
            ->where('scope', 'takeoff')
            ->whereNotNull('takeoff_condition_id')
            ->whereNull('parent_measurement_id')
            ->with(['deductions', 'drawing:id'])
            ->get();

        // Build a map of condition_id → net qty and labour_cost
        $condQtyMap = [];
        foreach ($measurements->groupBy('takeoff_condition_id') as $conditionId => $condMeasurements) {
            $netQty = 0;
            $labourCost = 0;
            foreach ($condMeasurements as $m) {
                $mul = 1.0;
                $netQty += ($m->computed_value ?? 0) * $mul;
                $labourCost += ($m->labour_cost ?? 0) * $mul;
                foreach ($m->deductions as $d) {
                    $netQty -= ($d->computed_value ?? 0) * $mul;
                    $labourCost -= ($d->labour_cost ?? 0) * $mul;
                }
            }
            $condQtyMap[$conditionId] = ['qty' => $netQty, 'labour_cost' => $labourCost];
        }

        // Build one row per condition × LCC pair
        $labourRows = [];

        foreach ($conditions as $condition) {
            $data = $condQtyMap[$condition->id] ?? null;
            if (! $data || $data['qty'] <= 0) {
                continue;
            }

            $netQty = $data['qty'];
            $condUnit = match ($condition->type) {
                'linear' => 'm',
                'area' => 'm²',
                'count' => 'EA',
                default => 'm',
            };

            if ($condition->pricing_method === 'detailed') {
                foreach ($condition->lineItems->where('entry_type', 'labour') as $li) {
                    $lcc = $li->labourCostCode;
                    if (! $lcc) {
                        continue;
                    }
                    $hr = $li->hourly_rate ?? 0;
                    $pr = $li->production_rate ?? 0;
                    if ($hr <= 0 || $pr <= 0) {
                        continue;
                    }
                    $costPerUnit = $hr / $pr;
                    $total = $netQty * $costPerUnit;
                    $hours = $netQty / $pr;

                    $labourRows[] = [
                        'code' => $lcc->code,
                        'name' => $lcc->name,
                        'qty' => round($netQty, 2),
                        'unit' => $condUnit,
                        'cost' => round($costPerUnit, 2),
                        'qty_per_hr' => round($pr, 2),
                        'hours' => round($hours, 2),
                        'total_cost' => round($total, 2),
                    ];
                }
            } elseif ($condition->pricing_method === 'unit_rate') {
                // BoQ: each labour item has a direct unit_rate (cost per measured unit)
                // and an optional production_rate for hours/status reporting.
                foreach ($condition->boqItems->where('kind', 'labour') as $item) {
                    $lcc = $item->labourCostCode;
                    $rate = (float) ($item->unit_rate ?? 0);
                    if ($rate <= 0) {
                        continue;
                    }

                    $pr = (float) ($item->production_rate ?? $lcc?->default_production_rate ?? 0);
                    $hours = $pr > 0 ? $netQty / $pr : 0;
                    $total = $netQty * $rate;

                    $labourRows[] = [
                        'code' => $lcc?->code ?? '—',
                        'name' => $lcc?->name ?? 'Legacy rate',
                        'qty' => round($netQty, 2),
                        'unit' => $condUnit,
                        'cost' => round($rate, 2),
                        'qty_per_hr' => round($pr, 2),
                        'hours' => round($hours, 2),
                        'total_cost' => round($total, 2),
                    ];
                }
            }
        }

        // Sort by LCC code, then by cost
        usort($labourRows, function ($a, $b) {
            $cmp = strcmp($a['code'], $b['code']);

            return $cmp !== 0 ? $cmp : $a['cost'] <=> $b['cost'];
        });

        return Inertia::render('drawings/labour', [
            'drawing' => $drawing,
            'revisions' => $revisions,
            'project' => $drawing->project,
            'activeTab' => 'labour',
            'projectDrawings' => $projectDrawings,
            'labourSummaries' => $labourRows,
        ]);
    }

    /**
     * Material summary — project-level material breakdown across all drawings.
     *
     * One row per condition × material line item.
     */
    public function material(Drawing $drawing): Response
    {
        [$drawing, $revisions, $projectDrawings] = $this->loadDrawingWithRevisions($drawing);
        $project = $drawing->project;

        $conditions = TakeoffCondition::where('location_id', $project->id)
            ->with([
                'lineItems' => fn ($q) => $q->where('entry_type', 'material'),
                'lineItems.materialItem.costCode',
                'lineItems.materialItem.supplier',
            ])
            ->get();

        // Aggregate base-bid measurements (excludes variation change-orders)
        $measurements = DrawingMeasurement::whereHas('drawing', fn ($q) => $q->where('project_id', $project->id))
            ->where('scope', 'takeoff')
            ->whereNotNull('takeoff_condition_id')
            ->whereNull('parent_measurement_id')
            ->with(['deductions', 'drawing:id'])
            ->get();

        // Build condition_id → net qty map
        $condQtyMap = [];
        foreach ($measurements->groupBy('takeoff_condition_id') as $conditionId => $condMeasurements) {
            $netQty = 0;
            foreach ($condMeasurements as $m) {
                $mul = 1.0;
                $netQty += ($m->computed_value ?? 0) * $mul;
                foreach ($m->deductions as $d) {
                    $netQty -= ($d->computed_value ?? 0) * $mul;
                }
            }
            $condQtyMap[$conditionId] = $netQty;
        }

        $materialRows = [];

        foreach ($conditions as $condition) {
            $netQty = $condQtyMap[$condition->id] ?? 0;
            if ($netQty <= 0) {
                continue;
            }

            $condUnit = match ($condition->type) {
                'linear' => 'm',
                'area' => 'm²',
                'count' => 'EA',
                default => 'm',
            };

            if ($condition->pricing_method === 'detailed') {
                // Secondary qty = primary / height (theoretical per-unit)
                $pvPerUnit = ($condition->type === 'area' || $condition->type === 'linear')
                    && $condition->height && $condition->height > 0
                    ? $netQty / $condition->height : 0;

                foreach ($condition->lineItems->where('entry_type', 'material') as $li) {
                    $mat = $li->materialItem;

                    // Resolve base quantity from source
                    $baseQty = match ($li->qty_source) {
                        'secondary' => $pvPerUnit,
                        'fixed' => $li->fixed_qty ?? 0,
                        default => $netQty, // 'primary'
                    };
                    if ($baseQty <= 0) {
                        continue;
                    }

                    // Apply OC spacing and layers
                    $layers = max(1, $li->layers);
                    $lineQty = ($li->oc_spacing && $li->oc_spacing > 0)
                        ? ($baseQty / $li->oc_spacing) * $layers
                        : $baseQty * $layers;

                    // Apply waste
                    $waste = $li->waste_percentage ?? 0;
                    $effectiveQty = $lineQty * (1 + $waste / 100);

                    // Cost
                    $unitCost = $li->unit_cost ?? ($mat ? $mat->unit_cost : 0);
                    $packSize = $li->pack_size;
                    $total = ($packSize && $packSize > 0)
                        ? ceil($effectiveQty / $packSize) * $unitCost
                        : $effectiveQty * $unitCost;

                    // Format pack size display
                    $perDisplay = $this->formatPackSize($packSize, $li->uom ?? $condUnit);

                    $materialRows[] = [
                        'item_code' => $li->item_code ?? ($mat?->code ?? ''),
                        'cost_code' => $mat?->costCode?->code ?? '',
                        'description' => $li->description ?? ($mat?->description ?? ''),
                        'qty' => round($effectiveQty, 2),
                        'uom' => $li->uom ?? $condUnit,
                        'mat_cost' => round($unitCost, 2),
                        'per' => $perDisplay,
                        'total' => round($total, 2),
                        'waste_pct' => $waste,
                        'units' => round($unitCost > 0 ? $total / $unitCost : 0, 2),
                        'price_updated' => $mat?->updated_at?->format('d/m/Y'),
                        'supplier' => $mat?->supplier?->name,
                    ];
                }
            }
            // unit_rate: no individual material items — cost codes only
        }

        // Sort by cost_code, then item_code
        usort($materialRows, function ($a, $b) {
            $cmp = strcmp($a['cost_code'], $b['cost_code']);

            return $cmp !== 0 ? $cmp : strcmp($a['item_code'], $b['item_code']);
        });

        return Inertia::render('drawings/material', [
            'drawing' => $drawing,
            'revisions' => $revisions,
            'project' => $drawing->project,
            'activeTab' => 'material',
            'projectDrawings' => $projectDrawings,
            'materialSummaries' => $materialRows,
        ]);
    }

    /**
     * Format a pack size for display (e.g., "1 m", "15kg bag", "1,000 EA").
     */
    private function formatPackSize(?float $packSize, string $unit): string
    {
        if (! $packSize || $packSize <= 0) {
            return '1 '.$unit;
        }
        if ($packSize == 1) {
            return '1 '.$unit;
        }

        return number_format($packSize, 0).' '.$unit;
    }

    /**
     * Estimate — project-level summary of all conditions with quantities & costs.
     */
    public function estimate(Drawing $drawing): Response
    {
        [$drawing, $revisions, $projectDrawings] = $this->loadDrawingWithRevisions($drawing);
        $project = $drawing->project;

        $conditions = TakeoffCondition::where('location_id', $project->id)
            ->with([
                'conditionType',
                'lineItems.materialItem',
                'materials.materialItem',
                'costCodes',
                'boqItems.costCode',
                'boqItems.labourCostCode',
                'conditionLabourCodes.labourCostCode',
            ])
            ->orderBy('condition_number')
            ->orderBy('name')
            ->get()
            ->keyBy('id');

        // Aggregate base-bid measurements (excludes variation change-orders)
        $measurements = DrawingMeasurement::whereHas('drawing', fn ($q) => $q->where('project_id', $project->id))
            ->where('scope', 'takeoff')
            ->whereNotNull('takeoff_condition_id')
            ->whereNull('parent_measurement_id')
            ->with(['deductions', 'drawing:id'])
            ->get();

        // Compute costs live so the estimate always matches the Labour tab,
        // even if the stored cost columns on measurements are stale.
        $calculator = new TakeoffCostCalculator;

        $condAgg = [];
        foreach ($measurements->groupBy('takeoff_condition_id') as $conditionId => $condMeasurements) {
            $condition = $conditions->get($conditionId);
            $netQty = 0;
            $matCost = 0;
            $labCost = 0;
            $totCost = 0;

            foreach ($condMeasurements as $m) {
                $netQty += $m->computed_value ?? 0;

                if ($condition) {
                    // Re-bind the condition (already eager-loaded with pricing relations)
                    // so the calculator doesn't re-query inside the loop.
                    $m->setRelation('condition', $condition);
                    $costs = $calculator->compute($m);
                    $matCost += $costs['material_cost'];
                    $labCost += $costs['labour_cost'];
                    $totCost += $costs['total_cost'];
                }

                foreach ($m->deductions as $d) {
                    $netQty -= $d->computed_value ?? 0;
                    if ($condition) {
                        $d->setRelation('condition', $condition);
                        $dCosts = $calculator->compute($d);
                        $matCost -= $dCosts['material_cost'];
                        $labCost -= $dCosts['labour_cost'];
                        $totCost -= $dCosts['total_cost'];
                    }
                }
            }

            $condAgg[$conditionId] = [
                'qty' => $netQty,
                'material_cost' => $matCost,
                'labour_cost' => $labCost,
                'total_cost' => $totCost,
            ];
        }

        $estimateRows = [];

        foreach ($conditions as $condition) {
            $agg = $condAgg[$condition->id] ?? ['qty' => 0, 'material_cost' => 0, 'labour_cost' => 0, 'total_cost' => 0];
            $netQty = $agg['qty'];
            $height = $condition->height;

            // Primary qty/uom
            [$qty1, $uom1] = match ($condition->type) {
                'area' => [$netQty, 'm²'],
                'linear' => [$netQty, 'm'],
                'count' => [$netQty, 'EA'],
                default => [$netQty, 'm'],
            };

            // Secondary qty/uom (derived from height)
            $qty2 = null;
            $uom2 = null;
            if ($height && $height > 0 && $netQty > 0) {
                if ($condition->type === 'area') {
                    // Area → linear run = area / height
                    $qty2 = round($netQty / $height, 0);
                    $uom2 = 'm';
                } elseif ($condition->type === 'linear') {
                    // Linear → area = length * height
                    $qty2 = round($netQty * $height, 0);
                    $uom2 = 'm²';
                }
            }

            $estimateRows[] = [
                'condition_id' => $condition->id,
                'condition_number' => $condition->condition_number,
                'name' => $condition->name,
                'condition_type' => $condition->conditionType?->name ?? 'Uncategorized',
                'color' => $condition->color ?? '#888888',
                'qty1' => round($qty1, 0),
                'uom1' => $uom1,
                'qty2' => $qty2,
                'uom2' => $uom2,
                'material_cost' => round($agg['material_cost'], 2),
                'labour_cost' => round($agg['labour_cost'], 2),
                'sub_cost' => 0,
                'total_cost' => round($agg['total_cost'], 2),
            ];
        }

        return Inertia::render('drawings/estimate', [
            'drawing' => $drawing,
            'revisions' => $revisions,
            'project' => $drawing->project,
            'activeTab' => 'estimate',
            'projectDrawings' => $projectDrawings,
            'estimateRows' => $estimateRows,
        ]);
    }

    /**
     * Variations workspace — measure and price change orders on a drawing.
     */
    public function variations(Drawing $drawing): Response
    {
        [$drawing, $revisions, $projectDrawings] = $this->loadDrawingWithRevisions($drawing);

        return Inertia::render('drawings/variations', [
            'drawing' => $drawing,
            'revisions' => $revisions,
            'project' => $drawing->project,
            'activeTab' => 'variations',
            'projectDrawings' => $projectDrawings,
        ]);
    }

    /**
     * Production control workspace — track progress on a drawing.
     */
    public function production(Request $request, Drawing $drawing): Response
    {
        [$drawing, $revisions, $projectDrawings] = $this->loadDrawingWithRevisions($drawing);

        $workDate = $request->query('work_date', now()->toDateString());

        // Load takeoff measurements with condition's labour cost codes
        $measurements = DrawingMeasurement::where('drawing_id', $drawing->id)
            ->where('scope', 'takeoff')
            ->with(['condition.conditionLabourCodes.labourCostCode'])
            ->orderBy('created_at')
            ->get();

        // Load calibration
        $calibration = $drawing->scaleCalibration;

        // Build statuses lookup with carry-forward for the selected work date
        $statuses = $this->buildStatusesForDate($measurements->pluck('id'), $workDate);

        // Build segment statuses for segmented measurements (linear with 3+ points)
        $segmentStatuses = $this->buildAllSegmentStatusesForDate($measurements, $workDate);

        // Build LCC summary from conditions used on this drawing
        $lccSummary = $this->buildLccSummary($measurements, $statuses);

        return Inertia::render('drawings/production', [
            'drawing' => $drawing,
            'revisions' => $revisions,
            'project' => $drawing->project,
            'activeTab' => 'production',
            'projectDrawings' => $projectDrawings,
            'measurements' => $measurements,
            'calibration' => $calibration,
            'statuses' => $statuses,
            'segmentStatuses' => $segmentStatuses,
            'lccSummary' => array_values($lccSummary),
            'workDate' => $workDate,
        ]);
    }

    /**
     * Update percent complete for a measurement / labour cost code pair.
     */
    public function updateMeasurementStatus(Request $request, Drawing $drawing): JsonResponse
    {
        $validated = $request->validate([
            'measurement_id' => 'required|integer|exists:drawing_measurements,id',
            'labour_cost_code_id' => 'required|integer|exists:labour_cost_codes,id',
            'percent_complete' => 'required|integer|min:0|max:100',
            'work_date' => 'nullable|date',
        ]);

        $workDate = $validated['work_date'] ?? now()->toDateString();

        // Verify measurement belongs to this drawing
        $measurement = DrawingMeasurement::where('id', $validated['measurement_id'])
            ->where('drawing_id', $drawing->id)
            ->firstOrFail();

        $status = MeasurementStatus::updateOrCreate(
            [
                'drawing_measurement_id' => $measurement->id,
                'labour_cost_code_id' => $validated['labour_cost_code_id'],
                'work_date' => $workDate,
            ],
            [
                'percent_complete' => $validated['percent_complete'],
                'updated_by' => auth()->id(),
            ]
        );

        // Rebuild summary for response using date-scoped statuses
        $measurements = DrawingMeasurement::where('drawing_id', $drawing->id)
            ->where('scope', 'takeoff')
            ->with(['condition.conditionLabourCodes.labourCostCode'])
            ->get();

        $allStatuses = $this->buildStatusesForDate($measurements->pluck('id'), $workDate);

        // Sync aggregated percent_complete to budget_hours_entries
        $this->syncProductionToBudget($drawing, $workDate);

        return response()->json([
            'success' => true,
            'status' => $status,
            'lccSummary' => array_values($this->buildLccSummary($measurements, $allStatuses)),
        ]);
    }

    /**
     * Bulk update percent complete for multiple measurements.
     */
    public function bulkUpdateMeasurementStatus(Request $request, Drawing $drawing): JsonResponse
    {
        $validated = $request->validate([
            'measurement_ids' => 'required|array|min:1',
            'measurement_ids.*' => 'integer|exists:drawing_measurements,id',
            'labour_cost_code_id' => 'required|integer|exists:labour_cost_codes,id',
            'percent_complete' => 'required|integer|min:0|max:100',
            'work_date' => 'nullable|date',
        ]);

        $workDate = $validated['work_date'] ?? now()->toDateString();

        // Verify all measurements belong to this drawing
        $measurements = DrawingMeasurement::whereIn('id', $validated['measurement_ids'])
            ->where('drawing_id', $drawing->id)
            ->get();

        foreach ($measurements as $measurement) {
            MeasurementStatus::updateOrCreate(
                [
                    'drawing_measurement_id' => $measurement->id,
                    'labour_cost_code_id' => $validated['labour_cost_code_id'],
                    'work_date' => $workDate,
                ],
                [
                    'percent_complete' => $validated['percent_complete'],
                    'updated_by' => auth()->id(),
                ]
            );
        }

        // Rebuild summary using date-scoped statuses
        $allMeasurements = DrawingMeasurement::where('drawing_id', $drawing->id)
            ->where('scope', 'takeoff')
            ->with(['condition.conditionLabourCodes.labourCostCode'])
            ->get();

        $allStatuses = $this->buildStatusesForDate($allMeasurements->pluck('id'), $workDate);

        // Sync aggregated percent_complete to budget_hours_entries
        $this->syncProductionToBudget($drawing, $workDate);

        return response()->json([
            'success' => true,
            'updated_count' => $measurements->count(),
            'lccSummary' => array_values($this->buildLccSummary($allMeasurements, $allStatuses)),
        ]);
    }

    /**
     * Get production statuses for a specific work date (AJAX date-change).
     */
    public function getProductionStatuses(Request $request, Drawing $drawing): JsonResponse
    {
        $workDate = $request->query('work_date', now()->toDateString());

        $measurements = DrawingMeasurement::where('drawing_id', $drawing->id)
            ->where('scope', 'takeoff')
            ->with(['condition.conditionLabourCodes.labourCostCode'])
            ->get();

        $statuses = $this->buildStatusesForDate($measurements->pluck('id'), $workDate);
        $segmentStatuses = $this->buildAllSegmentStatusesForDate($measurements, $workDate);
        $lccSummary = $this->buildLccSummary($measurements, $statuses);

        return response()->json([
            'statuses' => $statuses,
            'segmentStatuses' => $segmentStatuses,
            'lccSummary' => array_values($lccSummary),
        ]);
    }

    // Production helper methods (buildLccSummary, buildStatusesForDate,
    // buildAllSegmentStatusesForDate) are provided by ProductionStatusTrait.

    /**
     * Update percent complete for a single segment of a measurement.
     */
    public function updateSegmentStatus(Request $request, Drawing $drawing): JsonResponse
    {
        $validated = $request->validate([
            'measurement_id' => 'required|integer|exists:drawing_measurements,id',
            'labour_cost_code_id' => 'required|integer|exists:labour_cost_codes,id',
            'segment_index' => 'required|integer|min:0',
            'percent_complete' => 'required|integer|min:0|max:100',
            'work_date' => 'nullable|date',
        ]);

        $workDate = $validated['work_date'] ?? now()->toDateString();

        $measurement = DrawingMeasurement::where('id', $validated['measurement_id'])
            ->where('drawing_id', $drawing->id)
            ->firstOrFail();

        // Validate segment index is within bounds
        $points = $measurement->points ?? [];
        $maxIndex = count($points) - 2; // N points = N-1 segments (0-indexed)
        if ($validated['segment_index'] > $maxIndex) {
            return response()->json(['error' => 'Invalid segment index'], 422);
        }

        MeasurementSegmentStatus::updateOrCreate(
            [
                'drawing_measurement_id' => $measurement->id,
                'labour_cost_code_id' => $validated['labour_cost_code_id'],
                'segment_index' => $validated['segment_index'],
                'work_date' => $workDate,
            ],
            [
                'percent_complete' => $validated['percent_complete'],
                'updated_by' => auth()->id(),
            ]
        );

        // Sync segment statuses to measurement-level status (weighted average)
        $this->syncSegmentToMeasurementStatus($measurement, $validated['labour_cost_code_id'], $workDate);

        // Rebuild everything for response
        $measurements = DrawingMeasurement::where('drawing_id', $drawing->id)
            ->where('scope', 'takeoff')
            ->with(['condition.conditionLabourCodes.labourCostCode'])
            ->get();

        $allStatuses = $this->buildStatusesForDate($measurements->pluck('id'), $workDate);
        $segmentStatuses = $this->buildAllSegmentStatusesForDate($measurements, $workDate);

        $this->syncProductionToBudget($drawing, $workDate);

        return response()->json([
            'success' => true,
            'statuses' => $allStatuses,
            'segmentStatuses' => $segmentStatuses,
            'lccSummary' => array_values($this->buildLccSummary($measurements, $allStatuses)),
        ]);
    }

    /**
     * Bulk update percent complete for multiple segments/measurements.
     */
    public function bulkUpdateSegmentStatus(Request $request, Drawing $drawing): JsonResponse
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.measurement_id' => 'required|integer|exists:drawing_measurements,id',
            'items.*.segment_index' => 'nullable|integer|min:0',
            'labour_cost_code_id' => 'required|integer|exists:labour_cost_codes,id',
            'percent_complete' => 'required|integer|min:0|max:100',
            'work_date' => 'nullable|date',
        ]);

        $workDate = $validated['work_date'] ?? now()->toDateString();
        $lccId = $validated['labour_cost_code_id'];
        $percent = $validated['percent_complete'];

        // Verify all measurements belong to this drawing
        $measurementIds = collect($validated['items'])->pluck('measurement_id')->unique();
        $measurements = DrawingMeasurement::whereIn('id', $measurementIds)
            ->where('drawing_id', $drawing->id)
            ->get()
            ->keyBy('id');

        $affectedMeasurementIds = [];

        foreach ($validated['items'] as $item) {
            $measurement = $measurements[$item['measurement_id']] ?? null;
            if (! $measurement) {
                continue;
            }

            if (isset($item['segment_index']) && $item['segment_index'] !== null) {
                // Segment-level update
                MeasurementSegmentStatus::updateOrCreate(
                    [
                        'drawing_measurement_id' => $measurement->id,
                        'labour_cost_code_id' => $lccId,
                        'segment_index' => $item['segment_index'],
                        'work_date' => $workDate,
                    ],
                    [
                        'percent_complete' => $percent,
                        'updated_by' => auth()->id(),
                    ]
                );
                $affectedMeasurementIds[$measurement->id] = true;
            } else {
                // Measurement-level update
                MeasurementStatus::updateOrCreate(
                    [
                        'drawing_measurement_id' => $measurement->id,
                        'labour_cost_code_id' => $lccId,
                        'work_date' => $workDate,
                    ],
                    [
                        'percent_complete' => $percent,
                        'updated_by' => auth()->id(),
                    ]
                );
            }
        }

        // Sync segment → measurement-level for affected segmented measurements
        foreach (array_keys($affectedMeasurementIds) as $measId) {
            $m = $measurements[$measId] ?? null;
            if ($m) {
                $this->syncSegmentToMeasurementStatus($m, $lccId, $workDate);
            }
        }

        // Rebuild everything for response
        $allMeasurements = DrawingMeasurement::where('drawing_id', $drawing->id)
            ->where('scope', 'takeoff')
            ->with(['condition.conditionLabourCodes.labourCostCode'])
            ->get();

        $allStatuses = $this->buildStatusesForDate($allMeasurements->pluck('id'), $workDate);
        $segmentStatuses = $this->buildAllSegmentStatusesForDate($allMeasurements, $workDate);

        $this->syncProductionToBudget($drawing, $workDate);

        return response()->json([
            'success' => true,
            'statuses' => $allStatuses,
            'segmentStatuses' => $segmentStatuses,
            'lccSummary' => array_values($this->buildLccSummary($allMeasurements, $allStatuses)),
        ]);
    }

    // syncSegmentToMeasurementStatus and syncProductionToBudget
    // are provided by ProductionStatusTrait.

    /**
     * Budget workspace — budget hours, earned hours, percent complete by area and LCC.
     */
    public function budget(Request $request, Drawing $drawing): Response
    {
        [$drawing, $revisions, $projectDrawings] = $this->loadDrawingWithRevisions($drawing);

        $workDate = $request->query('work_date', now()->toDateString());

        // Load ALL measurements across the project (all drawings) with conditions, LCCs
        $projectDrawingIds = Drawing::where('project_id', $drawing->project_id)->pluck('id');
        $measurements = DrawingMeasurement::whereIn('drawing_id', $projectDrawingIds)
            ->with(['condition.conditionLabourCodes.labourCostCode', 'variation:id,co_number'])
            ->orderBy('created_at')
            ->get();

        // Build statuses lookup using carry-forward for the work date
        $statuses = $this->buildStatusesForDate($measurements->pluck('id'), $workDate);

        $budgetRows = $this->buildBudgetRows($measurements, $statuses);

        // Load bid areas for this project
        $bidAreas = BidArea::where('location_id', $drawing->project_id)
            ->orderBy('sort_order')->orderBy('name')
            ->get(['id', 'name', 'parent_id', 'sort_order']);

        // Load project variations
        $variations = Variation::where('location_id', $drawing->project_id)
            ->select(['id', 'co_number', 'description', 'status'])
            ->orderBy('co_number')->get();

        // Load budget entries for the work date (used hours + date-specific percent complete)
        $budgetEntries = BudgetHoursEntry::where('location_id', $drawing->project_id)
            ->where('work_date', $workDate)
            ->get();

        $usedHoursMap = $budgetEntries
            ->mapWithKeys(fn ($e) => [($e->bid_area_id ?? 0).'-'.$e->labour_cost_code_id => $e->used_hours])
            ->toArray();

        $percentCompleteMap = $budgetEntries
            ->filter(fn ($e) => $e->percent_complete !== null)
            ->mapWithKeys(fn ($e) => [($e->bid_area_id ?? 0).'-'.$e->labour_cost_code_id => $e->percent_complete])
            ->toArray();

        return Inertia::render('drawings/budget', [
            'drawing' => $drawing,
            'revisions' => $revisions,
            'project' => $drawing->project,
            'activeTab' => 'budget',
            'projectDrawings' => $projectDrawings,
            'budgetRows' => $budgetRows,
            'bidAreas' => $bidAreas,
            'variations' => $variations,
            'usedHoursMap' => (object) $usedHoursMap,
            'percentCompleteMap' => (object) $percentCompleteMap,
            'workDate' => $workDate,
        ]);
    }

    /**
     * Get used hours for a project on a specific work date.
     */
    public function getUsedHours(Request $request, Location $location): JsonResponse
    {
        $workDate = $request->query('work_date', now()->toDateString());

        $budgetEntries = BudgetHoursEntry::where('location_id', $location->id)
            ->where('work_date', $workDate)
            ->get();

        $usedHoursMap = $budgetEntries
            ->mapWithKeys(fn ($e) => [($e->bid_area_id ?? 0).'-'.$e->labour_cost_code_id => $e->used_hours])
            ->toArray();

        $percentCompleteMap = $budgetEntries
            ->filter(fn ($e) => $e->percent_complete !== null)
            ->mapWithKeys(fn ($e) => [($e->bid_area_id ?? 0).'-'.$e->labour_cost_code_id => $e->percent_complete])
            ->toArray();

        return response()->json([
            'usedHoursMap' => $usedHoursMap,
            'percentCompleteMap' => $percentCompleteMap,
        ]);
    }

    /**
     * Store/update used hours for an area+LCC combo on a work date.
     */
    public function storeUsedHours(Request $request, Location $location): JsonResponse
    {
        $validated = $request->validate([
            'bid_area_id' => 'nullable|integer|exists:bid_areas,id',
            'labour_cost_code_id' => 'required|integer|exists:labour_cost_codes,id',
            'work_date' => 'required|date',
            'used_hours' => 'required|numeric|min:0',
            'percent_complete' => 'nullable|numeric|min:0|max:100',
        ]);

        $entry = BudgetHoursEntry::updateOrCreate(
            [
                'location_id' => $location->id,
                'bid_area_id' => $validated['bid_area_id'],
                'labour_cost_code_id' => $validated['labour_cost_code_id'],
                'work_date' => $validated['work_date'],
            ],
            [
                'used_hours' => $validated['used_hours'],
                'percent_complete' => $validated['percent_complete'] ?? null,
                'updated_by' => auth()->id(),
            ]
        );

        return response()->json(['success' => true, 'entry' => $entry]);
    }

    /**
     * Get used hours history for a specific area+LCC across all work dates.
     */
    public function getUsedHoursHistory(Request $request, Location $location): JsonResponse
    {
        $bidAreaId = $request->query('bid_area_id');
        $lccId = $request->query('labour_cost_code_id');

        if ($lccId) {
            // Specific LCC drill-down
            $query = BudgetHoursEntry::where('location_id', $location->id)
                ->where('labour_cost_code_id', $lccId)
                ->orderBy('work_date');

            if ($bidAreaId && $bidAreaId !== '0') {
                $query->where('bid_area_id', $bidAreaId);
            } else {
                $query->whereNull('bid_area_id');
            }

            $entries = $query->get()->map(fn ($e) => [
                'work_date' => $e->work_date->toDateString(),
                'used_hours' => (float) $e->used_hours,
                'percent_complete' => $e->percent_complete,
            ]);
        } else {
            // Project-level: aggregate all entries by date
            $entries = BudgetHoursEntry::where('location_id', $location->id)
                ->selectRaw('work_date, SUM(used_hours) as total_used')
                ->groupBy('work_date')
                ->orderBy('work_date')
                ->get()
                ->map(fn ($e) => [
                    'work_date' => \Carbon\Carbon::parse($e->work_date)->toDateString(),
                    'used_hours' => (float) $e->total_used,
                ]);
        }

        return response()->json(['history' => $entries]);
    }

    /**
     * Build flat budget rows aggregated by bid_area + LCC + scope + variation.
     *
     * Each row = unique combination of (bid_area_id, lcc_id, scope, variation_id).
     * Frontend groups/filters client-side.
     */
    private function buildBudgetRows($measurements, array $statuses): array
    {
        $rows = [];

        foreach ($measurements as $measurement) {
            if (! $measurement->condition || ! $measurement->condition->conditionLabourCodes) {
                continue;
            }

            $qty = (float) ($measurement->computed_value ?? 0);
            if ($qty <= 0) {
                continue;
            }

            $bidAreaId = $measurement->bid_area_id;
            $scope = $measurement->scope ?? 'takeoff';
            $variationId = $measurement->variation_id;
            $variationCoNumber = $measurement->variation?->co_number;

            foreach ($measurement->condition->conditionLabourCodes as $clc) {
                $lcc = $clc->labourCostCode;
                if (! $lcc) {
                    continue;
                }

                $key = ($bidAreaId ?? 0).'-'.$lcc->id.'-'.$scope.'-'.($variationId ?? 0);

                if (! isset($rows[$key])) {
                    $rows[$key] = [
                        'bid_area_id' => $bidAreaId,
                        'labour_cost_code_id' => $lcc->id,
                        'lcc_code' => $lcc->code,
                        'lcc_name' => $lcc->name,
                        'lcc_unit' => $lcc->unit,
                        'scope' => $scope,
                        'variation_id' => $variationId,
                        'variation_co_number' => $variationCoNumber,
                        'qty' => 0,
                        'budget_hours' => 0,
                        'weighted_qty_percent' => 0,
                        'measurement_count' => 0,
                    ];
                }

                $percent = $statuses[$measurement->id.'-'.$lcc->id] ?? 0;
                $productionRate = (float) ($clc->production_rate ?? $lcc->default_production_rate ?? 0);
                $budgetHours = $productionRate > 0 ? $qty / $productionRate : 0;

                $rows[$key]['qty'] += $qty;
                $rows[$key]['budget_hours'] += $budgetHours;
                $rows[$key]['weighted_qty_percent'] += $qty * $percent;
                $rows[$key]['measurement_count']++;
            }
        }

        // Calculate final weighted percent and earned hours
        foreach ($rows as &$row) {
            $row['percent_complete'] = $row['qty'] > 0
                ? round($row['weighted_qty_percent'] / $row['qty'], 1)
                : 0;
            $row['earned_hours'] = round($row['budget_hours'] * ($row['percent_complete'] / 100), 2);
            $row['budget_hours'] = round($row['budget_hours'], 2);
            unset($row['weighted_qty_percent']);
        }

        return array_values($rows);
    }

    /**
     * Load a drawing with its project, revisions, and observations.
     *
     * @return array{0: Drawing, 1: \Illuminate\Support\Collection, 2: \Illuminate\Support\Collection}
     */
    private function loadDrawingWithRevisions(Drawing $drawing): array
    {
        $drawing->load([
            'project:id,name',
            'previousRevision.media',
            'createdBy',
            'observations.createdBy',
            'media',
        ]);

        $revisions = [];
        if ($drawing->sheet_number && $drawing->project_id) {
            $revisions = Drawing::where('project_id', $drawing->project_id)
                ->where('sheet_number', $drawing->sheet_number)
                ->with('media')
                ->select(['id', 'sheet_number', 'revision_number', 'status', 'created_at'])
                ->orderBy('created_at', 'desc')
                ->get();
        }

        $projectDrawings = Drawing::where('project_id', $drawing->project_id)
            ->where('status', Drawing::STATUS_ACTIVE)
            ->select(['id', 'sheet_number', 'title'])
            ->withCount(['measurements as has_takeoff' => function ($q) {
                $q->where('scope', 'takeoff');
            }])
            ->orderBy('sheet_number')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn ($d) => [
                'id' => $d->id,
                'display_name' => $d->display_name,
                'sheet_number' => $d->sheet_number,
                'has_takeoff' => $d->has_takeoff > 0,
            ]);

        return [$drawing, $revisions, $projectDrawings];
    }

    /**
     * Update drawing metadata.
     */
    public function update(Request $request, Drawing $drawing): JsonResponse
    {
        $validated = $request->validate([
            'sheet_number' => ['nullable', 'string', 'max:100'],
            'title' => ['nullable', 'string', 'max:500'],
            'revision_number' => ['nullable', 'string', 'max:50'],
        ]);

        $drawing->update(array_filter($validated, fn ($v) => $v !== null));

        return response()->json([
            'success' => true,
            'message' => 'Drawing updated successfully.',
            'drawing' => $drawing->fresh(),
        ]);
    }

    /**
     * Soft delete a drawing.
     */
    public function destroy(Drawing $drawing)
    {
        $drawing->delete();

        // If this was the active revision, promote the previous one
        if ($drawing->status === Drawing::STATUS_ACTIVE && $drawing->sheet_number && $drawing->project_id) {
            $previousRevision = Drawing::where('project_id', $drawing->project_id)
                ->where('sheet_number', $drawing->sheet_number)
                ->where('id', '!=', $drawing->id)
                ->whereIn('status', [Drawing::STATUS_SUPERSEDED])
                ->orderBy('created_at', 'desc')
                ->first();

            if ($previousRevision) {
                $previousRevision->makeActive();
            }
        }

        return redirect()->back()->with('success', 'Drawing deleted successfully.');
    }

    /**
     * Soft delete multiple drawings at once.
     */
    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:drawings,id'],
        ]);

        $drawings = Drawing::whereIn('id', $validated['ids'])->get();

        DB::transaction(function () use ($drawings) {
            foreach ($drawings as $drawing) {
                $wasActive = $drawing->status === Drawing::STATUS_ACTIVE;
                $sheetNumber = $drawing->sheet_number;
                $projectId = $drawing->project_id;

                $drawing->delete();

                if ($wasActive && $sheetNumber && $projectId) {
                    $previousRevision = Drawing::where('project_id', $projectId)
                        ->where('sheet_number', $sheetNumber)
                        ->where('id', '!=', $drawing->id)
                        ->whereIn('status', [Drawing::STATUS_SUPERSEDED])
                        ->orderBy('created_at', 'desc')
                        ->first();

                    if ($previousRevision) {
                        $previousRevision->makeActive();
                    }
                }
            }
        });

        $count = $drawings->count();

        return redirect()->back()->with('success', "{$count} ".($count === 1 ? 'drawing' : 'drawings').' deleted successfully.');
    }

    /**
     * Download a drawing file via Spatie Media Library.
     */
    public function download(Drawing $drawing)
    {
        $media = $drawing->getFirstMedia('source');

        if (! $media) {
            return redirect()->back()->with('error', 'No file associated with this drawing.');
        }

        return redirect($media->getUrl());
    }

    /**
     * Serve a single map tile for the drawing viewer.
     * For S3: redirects to a temporary signed URL (browser loads directly from S3).
     * For local: streams from disk.
     */
    public function serveTile(Drawing $drawing, int $z, string $coords)
    {
        if (! $drawing->tiles_base_url) {
            abort(404);
        }

        $tilePath = "{$drawing->tiles_base_url}/{$z}/{$coords}.png";
        $disk = config('filesystems.drawings_disk', 'public');

        // S3: redirect to a temporary signed URL — browser fetches directly from S3
        if ($disk === 's3') {
            try {
                $url = Storage::disk('s3')->temporaryUrl($tilePath, now()->addHour());

                return redirect($url, 302, [
                    'Cache-Control' => 'public, max-age=3600',
                ]);
            } catch (\Exception $e) {
                abort(404);
            }
        }

        // Local disk: stream directly
        try {
            $stream = Storage::disk($disk)->readStream($tilePath);
            if ($stream) {
                $size = Storage::disk($disk)->size($tilePath);

                return response()->stream(
                    function () use ($stream) {
                        fpassthru($stream);
                        if (is_resource($stream)) {
                            fclose($stream);
                        }
                    },
                    200,
                    [
                        'Content-Type' => 'image/png',
                        'Content-Length' => $size,
                        'Cache-Control' => 'public, max-age=604800',
                    ]
                );
            }
        } catch (\Exception $e) {
            // Tile not found
        }

        abort(404);
    }

    /**
     * Get all revisions of a drawing's sheet.
     */
    public function getRevisions(Drawing $drawing): JsonResponse
    {
        if (! $drawing->sheet_number || ! $drawing->project_id) {
            return response()->json([
                'success' => true,
                'revisions' => [$drawing],
            ]);
        }

        $revisions = Drawing::where('project_id', $drawing->project_id)
            ->where('sheet_number', $drawing->sheet_number)
            ->orderBy('created_at', 'asc')
            ->get(['id', 'revision_number', 'sheet_number', 'title', 'created_at']);

        return response()->json([
            'success' => true,
            'drawing' => [
                'id' => $drawing->id,
                'sheet_number' => $drawing->sheet_number,
                'title' => $drawing->title,
            ],
            'revisions' => $revisions,
        ]);
    }

}
