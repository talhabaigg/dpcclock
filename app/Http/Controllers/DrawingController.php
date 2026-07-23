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
use App\Services\ChangeOrderGenerator;
use App\Services\TakeoffCostCalculator;
use App\Services\VariationCostCalculator;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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
        $drawings = Drawing::where('project_id', $project->id)
            ->where('status', Drawing::STATUS_ACTIVE)
            ->with('media')
            ->select([
                'id', 'project_id', 'sheet_number', 'title',
                'revision_number', 'status', 'created_at',
                'previous_revision_id', 'aconex_document_id', 'aconex_version_number',
            ])
            ->withCount(['measurements as takeoff_count' => function ($q) {
                $q->where('scope', 'takeoff');
            }])
            ->withCount(['siteTasks as pinned_task_count' => function ($q) {
                $q->whereNotNull('x')->whereNotNull('y');
            }])
            ->orderBy('sheet_number')
            ->orderBy('created_at', 'desc')
            ->get()
            // One row per sheet, not per revision. Every revision of a sheet is
            // left active by the Aconex import, so listing them raw showed the
            // same drawing several times over; the index is a list of drawings,
            // and which revision is current belongs inside it.
            ->groupBy(fn (Drawing $drawing) => $drawing->sheet_number ?: 'drawing-'.$drawing->id)
            ->map(function ($versions) {
                // Newest first, by the same rule the plan viewer uses: import
                // order lies when an older revision was imported after a newer
                // one, so Aconex's version sequence wins where both sides have
                // one and revision comparison covers manual uploads.
                return $versions->sort(function (Drawing $x, Drawing $y) {
                    if ($x->aconex_version_number !== null && $y->aconex_version_number !== null) {
                        return $y->aconex_version_number <=> $x->aconex_version_number;
                    }

                    return Drawing::compareRevisions($y->revision_number, $x->revision_number)
                        ?: ($y->created_at <=> $x->created_at);
                })->values();
            })
            ->map(function ($versions) {
                /** @var Drawing $drawing */
                $drawing = $versions->first();

                return [
                    'id' => $drawing->id,
                    'sheet_number' => $drawing->sheet_number,
                    'title' => $drawing->title,
                    'display_name' => $drawing->display_name,
                    'revision_number' => $drawing->revision_number,
                    'status' => $drawing->status,
                    'created_at' => $drawing->created_at,
                    'thumbnail_url' => $drawing->thumbnail_url,
                    // Summed across revisions: work pinned on an earlier
                    // revision still belongs to this sheet, and hiding it
                    // behind the grouping would make the row look untouched.
                    'takeoff_count' => $versions->sum('takeoff_count'),
                    'pinned_task_count' => $versions->sum('pinned_task_count'),
                    'revision_count' => $versions->count(),
                    // Aconex provenance — surfaced as a "Source" column in the list view.
                    'is_aconex' => $drawing->aconex_document_id !== null,
                    'aconex_version_number' => $drawing->aconex_version_number,
                    // Revision auto-imported from Aconex within the last week —
                    // surfaced as a "New revision" badge until it ages out.
                    'is_new_revision' => $drawing->aconex_document_id !== null
                        && $drawing->previous_revision_id !== null
                        && $drawing->created_at?->gt(now()->subDays(7)),
                ];
            })
            ->sortBy(fn (array $row) => $row['sheet_number'] ?? $row['display_name'])
            ->values();

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
                'revision_number', 'status', 'created_at',
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
     * Basic plan viewer — standalone read-only page, no takeoff tooling.
     * Only needs drawings.view.
     */
    public function plan(Request $request, Drawing $drawing): Response
    {
        $drawing->load('project:id,name');

        $comparison = null;
        $oldId = $request->integer('compare_old');
        $newId = $request->integer('compare_new');

        if ($oldId > 0 && $newId === $drawing->id && $oldId !== $newId) {
            $comparisonDrawings = Drawing::where('project_id', $drawing->project_id)
                ->whereKey([$oldId, $newId])
                ->get()
                ->keyBy('id');

            if ($comparisonDrawings->count() === 2) {
                $formatComparisonDrawing = fn (Drawing $plan) => [
                    'id' => $plan->id,
                    'display_name' => $plan->display_name,
                    'revision_number' => $plan->revision_number,
                    'created_at' => $plan->created_at,
                ];

                $comparison = [
                    'old' => $formatComparisonDrawing($comparisonDrawings->get($oldId)),
                    'new' => $formatComparisonDrawing($comparisonDrawings->get($newId)),
                ];
            }
        }

        $planOptions = Drawing::where('project_id', $drawing->project_id)
            ->select([
                'id',
                'project_id',
                'sheet_number',
                'title',
                'revision_number',
                'status',
                'created_at',
                'aconex_version_number',
            ])
            ->orderBy('sheet_number')
            ->orderByDesc('created_at')
            ->get()
            ->groupBy(fn (Drawing $plan) => $plan->sheet_number ?: 'drawing-'.$plan->id)
            ->map(function ($versions, $key) {
                // Newest revision first — import order (created_at) lies when
                // an older revision was imported after a newer one. Aconex's
                // version sequence is authoritative when both sides have one;
                // revision comparison covers manual uploads.
                $versions = $versions
                    ->sort(function (Drawing $x, Drawing $y) {
                        if ($x->aconex_version_number !== null && $y->aconex_version_number !== null) {
                            return $y->aconex_version_number <=> $x->aconex_version_number;
                        }

                        return Drawing::compareRevisions($y->revision_number, $x->revision_number)
                            ?: ($y->created_at <=> $x->created_at);
                    })
                    ->values();

                /** @var Drawing $representative */
                $representative = $versions->firstWhere('status', Drawing::STATUS_ACTIVE) ?? $versions->first();

                return [
                    'key' => (string) $key,
                    'sheet_number' => $representative->sheet_number,
                    'title' => $representative->title,
                    'display_name' => $representative->display_name,
                    'versions' => $versions->map(fn (Drawing $version) => [
                        'id' => $version->id,
                        'revision_number' => $version->revision_number,
                        'status' => $version->status,
                        'created_at' => $version->created_at,
                    ])->values(),
                ];
            })
            ->values();

        return Inertia::render('drawings/plan', [
            'drawing' => $drawing,
            'project' => $drawing->project,
            'planOptions' => $planOptions,
            'comparison' => $comparison,
        ]);
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
        $changeOrderGenerator = new ChangeOrderGenerator(new VariationCostCalculator);

        // Build per-(condition, area) buckets so the frontend can group by
        // either condition type or area without a second round-trip.
        $bucketed = [];

        foreach ($measurements as $m) {
            $conditionId = $m->takeoff_condition_id;
            $condition = $conditions->firstWhere('id', $conditionId);
            if (! $condition) {
                continue;
            }
            // When a condition has a manual_qty set, it overrides any
            // measurement-derived qty — the Conditions tab is the source of
            // truth and the Measure tab is hidden.
            if ($condition->manual_qty !== null) {
                continue;
            }
            $m->setRelation('condition', $condition);

            $areaId = $m->bidArea?->id;
            $areaName = $m->bidArea?->name ?? 'Unassigned';
            $key = $conditionId.'|'.($areaId ?? 'null');

            if (! isset($bucketed[$key])) {
                $bucketed[$key] = [
                    'condition' => $condition,
                    'condition_id' => (int) $conditionId,
                    'area_id' => $areaId,
                    'area_name' => $areaName,
                    'qty' => 0.0,
                    'material_cost' => 0.0,
                    'labour_cost' => 0.0,
                    'total_cost' => 0.0,
                ];
            }

            $costs = $calculator->compute($m);
            $bucketed[$key]['qty'] += $m->computed_value ?? 0;
            $bucketed[$key]['material_cost'] += $costs['material_cost'];
            $bucketed[$key]['labour_cost'] += $costs['labour_cost'];
            $bucketed[$key]['total_cost'] += $costs['total_cost'];

            foreach ($m->deductions as $d) {
                $d->setRelation('condition', $condition);
                $dCosts = $calculator->compute($d);
                $bucketed[$key]['qty'] -= $d->computed_value ?? 0;
                $bucketed[$key]['material_cost'] -= $dCosts['material_cost'];
                $bucketed[$key]['labour_cost'] -= $dCosts['labour_cost'];
                $bucketed[$key]['total_cost'] -= $dCosts['total_cost'];
            }
        }

        // Per-unit cost cache for each condition, computed from a unit-1
        // pseudo-measurement. Lets us populate unit_price for conditions
        // that have no measurements yet (so manual_qty entry drives the
        // total correctly) and for the synthetic 'manual' bucket below.
        $perUnitCosts = [];
        $perUnitFor = function (TakeoffCondition $c) use (&$perUnitCosts, $calculator) {
            $cid = (int) $c->id;
            if (isset($perUnitCosts[$cid])) {
                return $perUnitCosts[$cid];
            }
            $pseudo = new DrawingMeasurement([
                'computed_value' => 1.0,
                'perimeter_value' => 0.0,
            ]);
            $pseudo->setRelation('condition', $c);

            return $perUnitCosts[$cid] = $calculator->compute($pseudo);
        };

        // Ensure every condition appears in the conditions tab so the user
        // can enter a qty for it directly. For conditions with manual_qty,
        // build a synthetic bucket using the per-unit rate. For conditions
        // with no measurements and no manual_qty, add an empty bucket so
        // the row still shows.
        foreach ($conditions as $condition) {
            $cid = (int) $condition->id;
            $hasBucket = false;
            foreach ($bucketed as $row) {
                if ($row['condition_id'] === $cid) {
                    $hasBucket = true;
                    break;
                }
            }

            if ($condition->manual_qty !== null) {
                $qty = (float) $condition->manual_qty;
                $costsPerUnit = $perUnitFor($condition);

                $bucketed[$cid.'|manual'] = [
                    'condition' => $condition,
                    'condition_id' => $cid,
                    'area_id' => null,
                    'area_name' => 'Manual',
                    'qty' => $qty,
                    'material_cost' => $qty * $costsPerUnit['material_cost'],
                    'labour_cost' => $qty * $costsPerUnit['labour_cost'],
                    'total_cost' => $qty * $costsPerUnit['total_cost'],
                ];
            } elseif (! $hasBucket) {
                $bucketed[$cid.'|none'] = [
                    'condition' => $condition,
                    'condition_id' => $cid,
                    'area_id' => null,
                    'area_name' => 'Unassigned',
                    'qty' => 0.0,
                    'material_cost' => 0.0,
                    'labour_cost' => 0.0,
                    'total_cost' => 0.0,
                ];
            }
        }

        // Per-condition aggregates (across all areas) — used for sell-rate
        // calculation, since ratios are applied at the condition level.
        $perCondition = [];
        foreach ($bucketed as $row) {
            $cid = $row['condition_id'];
            if (! isset($perCondition[$cid])) {
                $perCondition[$cid] = [
                    'qty' => 0.0,
                    'material_cost' => 0.0,
                    'labour_cost' => 0.0,
                    'total_cost' => 0.0,
                ];
            }
            $perCondition[$cid]['qty'] += $row['qty'];
            $perCondition[$cid]['material_cost'] += $row['material_cost'];
            $perCondition[$cid]['labour_cost'] += $row['labour_cost'];
            $perCondition[$cid]['total_cost'] += $row['total_cost'];
        }

        // Sell rate per condition: premier cost (with location oncost ratios)
        // divided by qty. Mirrors `ClientVariationTab` premier_cost_per_unit.
        // Detailed-priced conditions are skipped — VariationCostCalculator
        // throws on detailed (computeDetailed not yet implemented).
        $sellRateByCondition = [];
        foreach ($conditions as $condition) {
            $cid = (int) $condition->id;
            if ($condition->pricing_method === 'detailed') {
                $sellRateByCondition[$cid] = null;

                continue;
            }
            // Use the aggregated cost when there's a qty; otherwise fall back
            // to the unit-1 per-unit cost so we can still display a sell rate
            // for conditions that have no measurements yet.
            $agg = $perCondition[$cid] ?? null;
            if ($agg && $agg['qty'] > 0) {
                $labour = $agg['labour_cost'];
                $material = $agg['material_cost'];
                $qty = $agg['qty'];
            } else {
                $unit = $perUnitFor($condition);
                $labour = $unit['labour_cost'];
                $material = $unit['material_cost'];
                $qty = 1.0;
            }
            $premier = $changeOrderGenerator->computeRowPremierCost([
                'labour_cost' => $labour,
                'material_cost' => $material,
                'qty' => $qty,
                'takeoff_condition_id' => $cid,
            ], $project, 'standard');
            $sellRateByCondition[$cid] = $premier / $qty;
        }

        $unitFor = fn (string $type) => match ($type) {
            'linear' => 'lm',
            'area' => 'm²',
            'count' => 'ea',
            default => 'm',
        };

        $lineItemsFor = fn (TakeoffCondition $c) => $c->pricing_method === 'detailed'
            ? $c->lineItems->map(fn ($li) => [
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
            : null;

        // Per-condition summary (one row per condition, areas listed)
        $conditionSummaries = [];
        foreach ($perCondition as $cid => $agg) {
            $condition = $conditions->firstWhere('id', $cid);
            if (! $condition) {
                continue;
            }
            // Collect unique area names for this condition
            $areaNames = [];
            foreach ($bucketed as $row) {
                if ($row['condition_id'] === $cid && $row['qty'] != 0) {
                    $areaNames[] = $row['area_name'];
                }
            }
            $uniqueAreas = array_values(array_unique($areaNames));

            // For conditions without measurements (qty=0), still surface the
            // theoretical per-unit rate so the user can see the price they'll
            // pay when entering a manual qty.
            $unitPrice = $agg['qty'] > 0
                ? $agg['total_cost'] / $agg['qty']
                : $perUnitFor($condition)['total_cost'];
            $sellRate = $sellRateByCondition[$cid] ?? null;

            $conditionSummaries[] = [
                'condition_id' => (int) $cid,
                'condition_number' => $condition->condition_number,
                'condition_name' => $condition->name,
                'condition_type' => $condition->conditionType?->name ?? 'Uncategorized',
                'type' => $condition->type,
                'pricing_method' => $condition->pricing_method,
                'color' => $condition->color,
                'height' => $condition->height,
                'description' => $condition->description,
                'manual_qty' => $condition->manual_qty !== null ? (float) $condition->manual_qty : null,
                'areas' => $uniqueAreas,
                'qty' => round($agg['qty'], 2),
                'unit' => $unitFor($condition->type),
                'unit_price' => round($unitPrice, 2),
                'sell_rate' => $sellRate !== null ? round($sellRate, 2) : null,
                'material_cost' => round($agg['material_cost'], 2),
                'labour_cost' => round($agg['labour_cost'], 2),
                'total_cost' => round($agg['total_cost'], 2),
                'sell_total' => $sellRate !== null ? round($sellRate * $agg['qty'], 2) : null,
                'line_items' => $lineItemsFor($condition),
            ];
        }

        // Per-(condition, area) rows — used by "Group by Area" view
        $conditionAreaRows = [];
        foreach ($bucketed as $row) {
            $condition = $row['condition'];
            $sellRate = $sellRateByCondition[$row['condition_id']] ?? null;
            $unitPrice = $row['qty'] > 0
                ? $row['total_cost'] / $row['qty']
                : $perUnitFor($condition)['total_cost'];

            $conditionAreaRows[] = [
                'condition_id' => $row['condition_id'],
                'condition_number' => $condition->condition_number,
                'condition_name' => $condition->name,
                'condition_type' => $condition->conditionType?->name ?? 'Uncategorized',
                'type' => $condition->type,
                'pricing_method' => $condition->pricing_method,
                'color' => $condition->color,
                'height' => $condition->height,
                'description' => $condition->description,
                'manual_qty' => $condition->manual_qty !== null ? (float) $condition->manual_qty : null,
                'area_id' => $row['area_id'],
                'area_name' => $row['area_name'],
                'qty' => round($row['qty'], 2),
                'unit' => $unitFor($condition->type),
                'unit_price' => round($unitPrice, 2),
                'sell_rate' => $sellRate !== null ? round($sellRate, 2) : null,
                'material_cost' => round($row['material_cost'], 2),
                'labour_cost' => round($row['labour_cost'], 2),
                'total_cost' => round($row['total_cost'], 2),
                'sell_total' => $sellRate !== null ? round($sellRate * $row['qty'], 2) : null,
                'line_items' => $lineItemsFor($condition),
            ];
        }

        // Sort by condition number, then area name
        usort($conditionSummaries, fn ($a, $b) => ($a['condition_number'] ?? 0) <=> ($b['condition_number'] ?? 0));
        usort($conditionAreaRows, function ($a, $b) {
            $byNum = ($a['condition_number'] ?? 0) <=> ($b['condition_number'] ?? 0);

            return $byNum !== 0 ? $byNum : strcmp($a['area_name'], $b['area_name']);
        });

        return Inertia::render('drawings/conditions', [
            'drawing' => $drawing,
            'revisions' => $revisions,
            'project' => $drawing->project,
            'activeTab' => 'conditions',
            'projectDrawings' => $projectDrawings,
            'conditionSummaries' => $conditionSummaries,
            'conditionAreaRows' => $conditionAreaRows,
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
                    // Master project rate takes precedence; per-line override is legacy fallback.
                    $hr = $project->master_hourly_rate ?? $li->hourly_rate ?? 0;
                    $pr = $li->production_rate ?? 0;
                    if ($hr <= 0 || $pr <= 0) {
                        continue;
                    }
                    $costPerUnit = $hr / $pr;
                    $total = $netQty * $costPerUnit;
                    $hours = $netQty / $pr;

                    $lcc = $li->labourCostCode;
                    $labourRows[] = [
                        'code' => $lcc?->code ?? $li->item_code ?? '—',
                        'name' => $lcc?->name ?? $li->description ?? 'Unmapped labour',
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
            'masterHourlyRate' => $project->master_hourly_rate !== null
                ? (float) $project->master_hourly_rate
                : null,
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
        $lccId = $request->query('lcc_id');
        $lccId = $lccId !== null && $lccId !== '' ? (int) $lccId : null;

        $measurements = DrawingMeasurement::where('drawing_id', $drawing->id)
            ->where('scope', 'takeoff')
            ->with(['condition.conditionLabourCodes.labourCostCode'])
            ->get();

        $statuses = $this->buildStatusesForDate($measurements->pluck('id'), $workDate);
        $segmentStatuses = $this->buildAllSegmentStatusesForDate($measurements, $workDate, $lccId);
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

        // Per-LCC segment progress (seg_status_unique_v3): each labour cost code
        // tracks its own % per segment per date, mirroring the measurement-level
        // status model so switching LCCs shows that trade's actual progress.
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
        // Return only the current LCC's segment statuses so the frontend's
        // segmentStatuses map reflects this LCC's view.
        $segmentStatuses = $this->buildAllSegmentStatusesForDate($measurements, $workDate, (int) $validated['labour_cost_code_id']);

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
                // Per-LCC segment progress (v3 unique includes labour_cost_code_id).
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
        $segmentStatuses = $this->buildAllSegmentStatusesForDate($allMeasurements, $workDate, $lccId);

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
                    'work_date' => Carbon::parse($e->work_date)->toDateString(),
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
                        'earned_hours' => 0,
                        'measurement_count' => 0,
                    ];
                }

                $percent = $statuses[$measurement->id.'-'.$lcc->id] ?? 0;
                $productionRate = (float) ($clc->production_rate ?? $lcc->default_production_rate ?? 0);
                $perTakeoffBudget = $productionRate > 0 ? $qty / $productionRate : 0;
                // earned MUST be summed per-measurement (not budget × overall %),
                // because rates vary across takeoffs within the same (area, LCC).
                // Σ(qty_i × pct_i / rate_i) ≠ (Σ qty_i/rate_i) × Σ(qty_i × pct_i)/Σ qty_i
                $perTakeoffEarned = $perTakeoffBudget * ($percent / 100);

                $rows[$key]['qty'] += $qty;
                $rows[$key]['budget_hours'] += $perTakeoffBudget;
                $rows[$key]['earned_hours'] += $perTakeoffEarned;
                $rows[$key]['measurement_count']++;
            }
        }

        foreach ($rows as &$row) {
            $row['percent_complete'] = $row['budget_hours'] > 0
                ? round($row['earned_hours'] / $row['budget_hours'] * 100, 1)
                : 0;
            $row['earned_hours'] = round($row['earned_hours'], 2);
            $row['budget_hours'] = round($row['budget_hours'], 2);
        }

        return array_values($rows);
    }

    /**
     * Load a drawing with its project, revisions, and observations.
     *
     * @return array{0: Drawing, 1: Collection, 2: Collection}
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
