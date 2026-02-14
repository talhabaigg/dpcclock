<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessDrawingJob;
use App\Models\BidArea;
use App\Models\BudgetHoursEntry;
use App\Models\Drawing;
use App\Models\DrawingAlignment;
use App\Models\DrawingMeasurement;
use App\Models\DrawingObservation;
use App\Models\Location;
use App\Models\MeasurementSegmentStatus;
use App\Models\MeasurementStatus;
use App\Models\Variation;
use App\Services\DrawingComparisonService;
use App\Services\DrawingMetadataService;
use App\Services\DrawingProcessingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class DrawingController extends Controller
{
    /**
     * List active drawings for a project, grouped by sheet_number.
     */
    public function index(Request $request, Location $project): Response
    {
        $drawings = Drawing::where('project_id', $project->id)
            ->where('status', Drawing::STATUS_ACTIVE)
            ->select([
                'id', 'project_id', 'sheet_number', 'title', 'discipline',
                'revision_number', 'revision_date', 'status',
                'drawing_number', 'drawing_title', 'revision',
                'thumbnail_path', 'thumbnail_s3_key', 'page_preview_s3_key',
                'created_at',
            ])
            ->orderBy('sheet_number')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($drawing) {
                return [
                    'id' => $drawing->id,
                    'sheet_number' => $drawing->sheet_number,
                    'title' => $drawing->title,
                    'display_name' => $drawing->display_name,
                    'discipline' => $drawing->discipline,
                    'revision_number' => $drawing->revision_number ?? $drawing->revision,
                    'drawing_number' => $drawing->drawing_number,
                    'drawing_title' => $drawing->drawing_title,
                    'status' => $drawing->status,
                    'created_at' => $drawing->created_at,
                    'thumbnail_url' => $drawing->thumbnail_url,
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
            ->select([
                'id', 'project_id', 'sheet_number', 'title', 'original_name',
                'status', 'extraction_status', 'mime_type', 'file_size',
                'drawing_number', 'drawing_title', 'revision',
                'thumbnail_s3_key', 'page_preview_s3_key',
                'created_at',
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
                    $directory = 'drawings/'.$project->id;

                    $sha256 = hash_file('sha256', $file->getRealPath());

                    $disk = config('filesystems.drawings_disk');
                    $filePath = $file->storeAs(
                        $directory,
                        time().'_'.$fileName,
                        $disk
                    );

                    if (! $filePath) {
                        throw new \RuntimeException("Failed to store file: {$fileName}");
                    }

                    $drawing = Drawing::create([
                        'project_id' => $project->id,
                        'storage_path' => $filePath,
                        'original_name' => $fileName,
                        'mime_type' => $file->getClientMimeType(),
                        'file_size' => $file->getSize(),
                        'sha256' => $sha256,
                        'sheet_number' => $validated['sheet_number'] ?? null,
                        'title' => $validated['title'] ?? pathinfo($fileName, PATHINFO_FILENAME),
                        'revision_number' => $validated['revision_number'] ?? null,
                        'status' => Drawing::STATUS_DRAFT,
                    ]);

                    // If sheet_number provided, handle revision chain
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

            // Dispatch processing jobs
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

    /**
     * Build aggregated Labour Cost Code summary for production tracking.
     *
     * Per LCC: quantity-weighted % = Sum(qty × %) / Sum(qty)
     * Budget hours = Sum(qty / production_rate) for each measurement
     */
    private function buildLccSummary($measurements, array $statuses): array
    {
        $summary = [];

        foreach ($measurements as $measurement) {
            if (! $measurement->condition || ! $measurement->condition->conditionLabourCodes) {
                continue;
            }

            $qty = (float) ($measurement->computed_value ?? 0);
            if ($qty <= 0) {
                continue;
            }

            foreach ($measurement->condition->conditionLabourCodes as $clc) {
                $lcc = $clc->labourCostCode;
                if (! $lcc) {
                    continue;
                }

                $lccId = $lcc->id;
                if (! isset($summary[$lccId])) {
                    $summary[$lccId] = [
                        'labour_cost_code_id' => $lccId,
                        'code' => $lcc->code,
                        'name' => $lcc->name,
                        'unit' => $lcc->unit,
                        'total_qty' => 0,
                        'budget_hours' => 0,
                        'weighted_qty_percent' => 0,
                        'measurement_count' => 0,
                    ];
                }

                $percent = $statuses[$measurement->id.'-'.$lccId] ?? 0;
                // Use condition-level override, fallback to LCC default
                $productionRate = (float) ($clc->production_rate ?? $lcc->default_production_rate ?? 0);
                $budgetHours = $productionRate > 0 ? $qty / $productionRate : 0;

                $summary[$lccId]['total_qty'] += $qty;
                $summary[$lccId]['budget_hours'] += $budgetHours;
                $summary[$lccId]['weighted_qty_percent'] += $qty * $percent;
                $summary[$lccId]['measurement_count']++;
            }
        }

        // Calculate final weighted percent and earned hours
        foreach ($summary as &$item) {
            $item['weighted_percent'] = $item['total_qty'] > 0
                ? round($item['weighted_qty_percent'] / $item['total_qty'], 1)
                : 0;
            $item['earned_hours'] = round($item['budget_hours'] * ($item['weighted_percent'] / 100), 2);
            $item['budget_hours'] = round($item['budget_hours'], 2);
            unset($item['weighted_qty_percent']);
        }

        return $summary;
    }

    /**
     * Build statuses map for a set of measurements as of a specific work date.
     * Uses carry-forward: for each (measurement, LCC), picks the most recent record where work_date <= $workDate.
     * Falls back to undated (NULL work_date) records from before the migration.
     *
     * @return array<string, int> "measurementId-lccId" => percent_complete
     */
    private function buildStatusesForDate($measurementIds, string $workDate): array
    {
        if ($measurementIds->isEmpty()) {
            return [];
        }

        $allRecords = MeasurementStatus::whereIn('drawing_measurement_id', $measurementIds)
            ->where(function ($q) use ($workDate) {
                $q->whereNull('work_date')
                  ->orWhere('work_date', '<=', $workDate);
            })
            ->get();

        $statuses = [];
        foreach ($allRecords as $record) {
            $key = $record->drawing_measurement_id.'-'.$record->labour_cost_code_id;
            $recordDate = $record->work_date?->toDateString();

            if (! isset($statuses[$key])) {
                $statuses[$key] = ['percent' => $record->percent_complete, 'date' => $recordDate];
            } else {
                $existingDate = $statuses[$key]['date'];
                // Prefer dated records over NULL; among dated, prefer the most recent
                if ($existingDate === null && $recordDate !== null) {
                    $statuses[$key] = ['percent' => $record->percent_complete, 'date' => $recordDate];
                } elseif ($recordDate !== null && $existingDate !== null && $recordDate > $existingDate) {
                    $statuses[$key] = ['percent' => $record->percent_complete, 'date' => $recordDate];
                }
            }
        }

        return array_map(fn ($s) => $s['percent'], $statuses);
    }

    /**
     * Build segment statuses for all segmented measurements (linear with 3+ points) as of a work date.
     * Uses carry-forward: picks most recent record where work_date <= $workDate.
     *
     * @return array<string, int> "measurementId-segmentIndex" => percent_complete
     */
    private function buildAllSegmentStatusesForDate($measurements, string $workDate): array
    {
        // Find measurements that qualify for segment statusing (linear, 3+ points = 2+ segments)
        $segmentedIds = $measurements->filter(function ($m) {
            return $m->type === 'linear' && is_array($m->points) && count($m->points) >= 3;
        })->pluck('id');

        if ($segmentedIds->isEmpty()) {
            return [];
        }

        $allRecords = MeasurementSegmentStatus::whereIn('drawing_measurement_id', $segmentedIds)
            ->where(function ($q) use ($workDate) {
                $q->whereNull('work_date')
                  ->orWhere('work_date', '<=', $workDate);
            })
            ->get();

        $statuses = [];
        foreach ($allRecords as $record) {
            $key = $record->drawing_measurement_id.'-'.$record->segment_index;
            $recordDate = $record->work_date?->toDateString();

            if (! isset($statuses[$key])) {
                $statuses[$key] = ['percent' => $record->percent_complete, 'date' => $recordDate];
            } else {
                $existingDate = $statuses[$key]['date'];
                if ($existingDate === null && $recordDate !== null) {
                    $statuses[$key] = ['percent' => $record->percent_complete, 'date' => $recordDate];
                } elseif ($recordDate !== null && $existingDate !== null && $recordDate > $existingDate) {
                    $statuses[$key] = ['percent' => $record->percent_complete, 'date' => $recordDate];
                }
            }
        }

        return array_map(fn ($s) => $s['percent'], $statuses);
    }

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

    /**
     * Sync segment-level statuses to measurement-level status via weighted average.
     * Segment lengths are computed from normalized points (ratio-based, no calibration needed).
     */
    private function syncSegmentToMeasurementStatus(DrawingMeasurement $measurement, int $lccId, string $workDate): void
    {
        $points = $measurement->points ?? [];
        $numSegments = count($points) - 1;
        if ($numSegments < 2) {
            return; // Not segmented, nothing to sync
        }

        // Compute segment lengths from normalized points
        $segmentLengths = [];
        $totalLength = 0;
        for ($i = 0; $i < $numSegments; $i++) {
            $dx = ($points[$i + 1]['x'] ?? 0) - ($points[$i]['x'] ?? 0);
            $dy = ($points[$i + 1]['y'] ?? 0) - ($points[$i]['y'] ?? 0);
            $len = sqrt($dx * $dx + $dy * $dy);
            $segmentLengths[$i] = $len;
            $totalLength += $len;
        }

        if ($totalLength <= 0) {
            return;
        }

        // Build segment statuses for this measurement+LCC with carry-forward
        $segRecords = MeasurementSegmentStatus::where('drawing_measurement_id', $measurement->id)
            ->where('labour_cost_code_id', $lccId)
            ->where(function ($q) use ($workDate) {
                $q->whereNull('work_date')
                  ->orWhere('work_date', '<=', $workDate);
            })
            ->get();

        $segStatuses = [];
        foreach ($segRecords as $rec) {
            $idx = $rec->segment_index;
            $date = $rec->work_date?->toDateString();
            if (! isset($segStatuses[$idx])) {
                $segStatuses[$idx] = ['percent' => $rec->percent_complete, 'date' => $date];
            } else {
                $existing = $segStatuses[$idx]['date'];
                if ($existing === null && $date !== null) {
                    $segStatuses[$idx] = ['percent' => $rec->percent_complete, 'date' => $date];
                } elseif ($date !== null && $existing !== null && $date > $existing) {
                    $segStatuses[$idx] = ['percent' => $rec->percent_complete, 'date' => $date];
                }
            }
        }

        // Compute weighted average
        $weightedSum = 0;
        for ($i = 0; $i < $numSegments; $i++) {
            $percent = $segStatuses[$i]['percent'] ?? 0;
            $weightedSum += $percent * $segmentLengths[$i];
        }
        $avgPercent = (int) round($weightedSum / $totalLength);

        // Write to measurement_statuses
        MeasurementStatus::updateOrCreate(
            [
                'drawing_measurement_id' => $measurement->id,
                'labour_cost_code_id' => $lccId,
                'work_date' => $workDate,
            ],
            [
                'percent_complete' => $avgPercent,
                'updated_by' => auth()->id(),
            ]
        );
    }

    /**
     * Sync aggregated production percent_complete to budget_hours_entries for a work date.
     * Computes weighted avg percent per (bid_area, LCC) from all project measurements and writes to budget table.
     */
    private function syncProductionToBudget(Drawing $drawing, string $workDate): void
    {
        $projectDrawingIds = Drawing::where('project_id', $drawing->project_id)->pluck('id');

        $measurements = DrawingMeasurement::whereIn('drawing_id', $projectDrawingIds)
            ->with(['condition.conditionLabourCodes.labourCostCode'])
            ->get();

        $statuses = $this->buildStatusesForDate($measurements->pluck('id'), $workDate);

        // Aggregate percent_complete per (bid_area_id, lcc_id)
        $agg = [];
        foreach ($measurements as $measurement) {
            if (! $measurement->condition || ! $measurement->condition->conditionLabourCodes) {
                continue;
            }

            $qty = (float) ($measurement->computed_value ?? 0);
            if ($qty <= 0) {
                continue;
            }

            $bidAreaId = $measurement->bid_area_id ?? 0;

            foreach ($measurement->condition->conditionLabourCodes as $clc) {
                $lcc = $clc->labourCostCode;
                if (! $lcc) {
                    continue;
                }

                $key = $bidAreaId.'-'.$lcc->id;
                $percent = $statuses[$measurement->id.'-'.$lcc->id] ?? 0;

                if (! isset($agg[$key])) {
                    $agg[$key] = ['bid_area_id' => $bidAreaId ?: null, 'lcc_id' => $lcc->id, 'total_qty' => 0, 'weighted' => 0];
                }

                $agg[$key]['total_qty'] += $qty;
                $agg[$key]['weighted'] += $qty * $percent;
            }
        }

        // Write aggregated percent_complete to budget_hours_entries
        foreach ($agg as $item) {
            $percentComplete = $item['total_qty'] > 0
                ? round($item['weighted'] / $item['total_qty'], 1)
                : 0;

            BudgetHoursEntry::updateOrCreate(
                [
                    'location_id' => $drawing->project_id,
                    'bid_area_id' => $item['bid_area_id'],
                    'labour_cost_code_id' => $item['lcc_id'],
                    'work_date' => $workDate,
                ],
                [
                    'percent_complete' => $percentComplete,
                    'updated_by' => auth()->id(),
                ]
            );
        }
    }

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
     * QA workspace — observations and defect tracking on a drawing.
     */
    public function qa(Drawing $drawing): Response
    {
        [$drawing, $revisions, $projectDrawings] = $this->loadDrawingWithRevisions($drawing);

        return Inertia::render('drawings/qa', [
            'drawing' => $drawing,
            'revisions' => $revisions,
            'project' => $drawing->project,
            'activeTab' => 'qa',
            'projectDrawings' => $projectDrawings,
        ]);
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
            'previousRevision:id,sheet_number,revision_number,thumbnail_path,thumbnail_s3_key,page_preview_s3_key',
            'createdBy',
            'observations.createdBy',
        ]);

        $revisions = [];
        if ($drawing->sheet_number && $drawing->project_id) {
            $revisions = Drawing::where('project_id', $drawing->project_id)
                ->where('sheet_number', $drawing->sheet_number)
                ->select([
                    'id', 'sheet_number', 'revision_number', 'revision_date', 'status',
                    'created_at', 'thumbnail_path', 'thumbnail_s3_key', 'page_preview_s3_key',
                    'drawing_number', 'drawing_title', 'revision', 'diff_image_path',
                ])
                ->orderBy('created_at', 'desc')
                ->get();
        }

        $projectDrawings = Drawing::where('project_id', $drawing->project_id)
            ->where('status', Drawing::STATUS_ACTIVE)
            ->select(['id', 'sheet_number', 'title', 'drawing_number', 'drawing_title'])
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
     * Update drawing metadata (confirm/edit extraction results).
     */
    public function update(Request $request, Drawing $drawing): JsonResponse
    {
        $validated = $request->validate([
            'drawing_number' => ['nullable', 'string', 'max:100'],
            'drawing_title' => ['nullable', 'string', 'max:500'],
            'revision' => ['nullable', 'string', 'max:50'],
            'sheet_number' => ['nullable', 'string', 'max:100'],
            'title' => ['nullable', 'string', 'max:500'],
            'discipline' => ['nullable', 'string', 'max:100'],
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
     * Download a drawing file.
     */
    public function download(Drawing $drawing)
    {
        $storagePath = $drawing->storage_path ?? $drawing->file_path;
        $fileName = $drawing->original_name ?? $drawing->file_name ?? 'drawing';

        if (! $storagePath) {
            return redirect()->back()->with('error', 'No file associated with this drawing.');
        }

        if (Storage::disk('public')->exists($storagePath)) {
            $path = Storage::disk('public')->path($storagePath);

            return response()->download($path, $fileName);
        }

        if (Storage::disk('s3')->exists($storagePath)) {
            $stream = Storage::disk('s3')->readStream($storagePath);
            $size = Storage::disk('s3')->size($storagePath);
            $mimeType = $drawing->mime_type ?? 'application/octet-stream';

            return response()->stream(
                function () use ($stream) {
                    fpassthru($stream);
                    if (is_resource($stream)) {
                        fclose($stream);
                    }
                },
                200,
                [
                    'Content-Type' => $mimeType,
                    'Content-Length' => $size,
                    'Content-Disposition' => 'attachment; filename="' . $fileName . '"',
                ]
            );
        }

        return redirect()->back()->with('error', 'File not found.');
    }

    /**
     * Serve a drawing file inline (for PDF viewer / image display).
     */
    public function serveFile(Drawing $drawing)
    {
        $storagePath = $drawing->storage_path ?? $drawing->file_path;
        $fileName = $drawing->original_name ?? $drawing->file_name ?? 'drawing.pdf';
        $mimeType = $drawing->mime_type ?? $drawing->file_type ?? 'application/pdf';

        if (! $storagePath) {
            abort(404, 'No file associated with this drawing.');
        }

        // Try local public disk first
        if (Storage::disk('public')->exists($storagePath)) {
            $stream = Storage::disk('public')->readStream($storagePath);
            $size = Storage::disk('public')->size($storagePath);

            return response()->stream(
                function () use ($stream) {
                    fpassthru($stream);
                    if (is_resource($stream)) {
                        fclose($stream);
                    }
                },
                200,
                [
                    'Content-Type' => $mimeType,
                    'Content-Length' => $size,
                    'Content-Disposition' => 'inline; filename="' . $fileName . '"',
                    'Cache-Control' => 'private, max-age=3600',
                ]
            );
        }

        // Try S3
        if (Storage::disk('s3')->exists($storagePath)) {
            $stream = Storage::disk('s3')->readStream($storagePath);
            $size = Storage::disk('s3')->size($storagePath);

            return response()->stream(
                function () use ($stream) {
                    fpassthru($stream);
                    if (is_resource($stream)) {
                        fclose($stream);
                    }
                },
                200,
                [
                    'Content-Type' => $mimeType,
                    'Content-Length' => $size,
                    'Content-Disposition' => 'inline; filename="' . $fileName . '"',
                    'Cache-Control' => 'private, max-age=3600',
                ]
            );
        }

        abort(404, 'File not found.');
    }

    /**
     * Serve a drawing thumbnail inline.
     */
    public function serveThumbnail(Drawing $drawing)
    {
        // Try local thumbnail first
        if ($drawing->thumbnail_path && Storage::disk('public')->exists($drawing->thumbnail_path)) {
            $stream = Storage::disk('public')->readStream($drawing->thumbnail_path);
            $size = Storage::disk('public')->size($drawing->thumbnail_path);
            $mimeType = Storage::disk('public')->mimeType($drawing->thumbnail_path) ?: 'image/png';

            return response()->stream(
                function () use ($stream) {
                    fpassthru($stream);
                    if (is_resource($stream)) {
                        fclose($stream);
                    }
                },
                200,
                [
                    'Content-Type' => $mimeType,
                    'Content-Length' => $size,
                    'Content-Disposition' => 'inline',
                    'Cache-Control' => 'public, max-age=86400',
                ]
            );
        }

        // Fall back to S3 thumbnail
        $s3Key = $drawing->thumbnail_s3_key;
        if ($s3Key && Storage::disk('s3')->exists($s3Key)) {
            $stream = Storage::disk('s3')->readStream($s3Key);
            $size = Storage::disk('s3')->size($s3Key);
            $mimeType = str_ends_with($s3Key, '.png') ? 'image/png' : 'image/jpeg';

            return response()->stream(
                function () use ($stream) {
                    fpassthru($stream);
                    if (is_resource($stream)) {
                        fclose($stream);
                    }
                },
                200,
                [
                    'Content-Type' => $mimeType,
                    'Content-Length' => $size,
                    'Content-Disposition' => 'inline',
                    'Cache-Control' => 'public, max-age=86400',
                ]
            );
        }

        abort(404, 'Thumbnail not found.');
    }

    /**
     * Serve a drawing diff image.
     */
    public function serveDiff(Drawing $drawing)
    {
        if (! $drawing->diff_image_path) {
            abort(404, 'No diff image available.');
        }

        $disk = config('filesystems.drawings_disk', 'public');

        if ($disk !== 's3' && Storage::disk($disk)->exists($drawing->diff_image_path)) {
            $stream = Storage::disk($disk)->readStream($drawing->diff_image_path);
            $size = Storage::disk($disk)->size($drawing->diff_image_path);

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
                    'Content-Disposition' => 'inline',
                    'Cache-Control' => 'public, max-age=86400',
                ]
            );
        }

        if (Storage::disk('s3')->exists($drawing->diff_image_path)) {
            $stream = Storage::disk('s3')->readStream($drawing->diff_image_path);
            $size = Storage::disk('s3')->size($drawing->diff_image_path);

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
                    'Content-Disposition' => 'inline',
                    'Cache-Control' => 'public, max-age=86400',
                ]
            );
        }

        abort(404, 'Diff image not found.');
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
     * Serve a drawing preview image from S3.
     */
    public function servePreview(Drawing $drawing)
    {
        if (! $drawing->page_preview_s3_key) {
            abort(404, 'No preview available');
        }

        $url = Storage::disk('s3')->temporaryUrl(
            $drawing->page_preview_s3_key,
            now()->addMinutes(5)
        );

        return redirect($url);
    }

    /**
     * Extract metadata from drawing using AI.
     */
    public function extractMetadata(Drawing $drawing, DrawingMetadataService $metadataService)
    {
        $result = $metadataService->extractMetadata($drawing);

        if (! $result['success']) {
            return response()->json([
                'success' => false,
                'message' => 'Metadata extraction failed',
                'error' => $result['error'] ?? 'Unknown error',
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'Metadata extracted successfully',
            'metadata' => $result['metadata'],
            'confidence' => $result['confidence'],
        ]);
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
            ->whereNotNull('page_preview_s3_key')
            ->orderBy('created_at', 'asc')
            ->get(['id', 'revision_number', 'revision', 'drawing_number', 'drawing_title', 'created_at']);

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

    /**
     * Compare two drawing revisions using AI.
     */
    public function compareRevisions(Request $request): JsonResponse
    {
        set_time_limit(180);
        ini_set('memory_limit', '1G');

        $validated = $request->validate([
            'drawing_a_id' => ['required', 'integer', 'exists:drawings,id'],
            'drawing_b_id' => ['required', 'integer', 'exists:drawings,id'],
            'context' => ['nullable', 'string', 'max:200'],
            'additional_prompt' => ['nullable', 'string', 'max:1000'],
        ]);

        $drawingA = Drawing::findOrFail($validated['drawing_a_id']);
        $drawingB = Drawing::findOrFail($validated['drawing_b_id']);

        $getImagePath = fn ($d) => $d->page_preview_s3_key ?: $d->thumbnail_path;

        $imagePathA = $getImagePath($drawingA);
        $imagePathB = $getImagePath($drawingB);

        if (! $imagePathA || ! $imagePathB) {
            return response()->json([
                'success' => false,
                'message' => 'Both drawings must have preview images to compare.',
            ], 422);
        }

        $comparisonService = app(DrawingComparisonService::class);

        $imageA = $comparisonService->getImageDataUrl($imagePathA);
        $imageB = $comparisonService->getImageDataUrl($imagePathB);

        if (! $imageA || ! $imageB) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to load drawing images from storage.',
            ], 500);
        }

        $rawImageA = $comparisonService->getRawImageData($imagePathA);
        $rawImageB = $comparisonService->getRawImageData($imagePathB);

        $context = $validated['context'] ?? 'walls and ceilings construction drawings';
        $additionalPrompt = $validated['additional_prompt'] ?? null;
        $result = $comparisonService->compareRevisionsHybrid(
            $imageA,
            $imageB,
            $rawImageA,
            $rawImageB,
            $context,
            $additionalPrompt
        );

        if (! $result['success']) {
            return response()->json([
                'success' => false,
                'message' => 'AI comparison failed: ' . ($result['error'] ?? 'Unknown error'),
            ], 500);
        }

        return response()->json([
            'success' => true,
            'comparison' => [
                'drawing_a' => [
                    'id' => $drawingA->id,
                    'drawing_number' => $drawingA->drawing_number,
                    'revision' => $drawingA->revision,
                ],
                'drawing_b' => [
                    'id' => $drawingB->id,
                    'drawing_number' => $drawingB->drawing_number,
                    'revision' => $drawingB->revision,
                ],
                'summary' => $result['summary'],
                'changes' => $result['changes'],
                'change_count' => $result['change_count'] ?? count($result['changes'] ?? []),
                'confidence' => $result['confidence'] ?? 'unknown',
                'notes' => $result['notes'] ?? null,
                'method' => $result['method'] ?? 'ai_only',
                'diff_image' => $result['diff_image'] ?? null,
                'visualization' => $result['visualization'] ?? null,
            ],
        ]);
    }

    /**
     * Save AI-detected changes as observations.
     */
    public function saveComparisonAsObservations(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'drawing_a_id' => ['required', 'integer', 'exists:drawings,id'],
            'drawing_b_id' => ['required', 'integer', 'exists:drawings,id'],
            'target_drawing_id' => ['required', 'integer', 'exists:drawings,id'],
            'changes' => ['required', 'array', 'min:1'],
            'changes.*.type' => ['required', 'string'],
            'changes.*.description' => ['required', 'string', 'max:2000'],
            'changes.*.location' => ['required', 'string'],
            'changes.*.impact' => ['required', 'string', 'in:low,medium,high'],
            'changes.*.potential_change_order' => ['required', 'boolean'],
            'changes.*.reason' => ['nullable', 'string'],
            'changes.*.page_number' => ['nullable', 'integer', 'min:1'],
            'changes.*.coordinates' => ['nullable', 'array'],
            'changes.*.coordinates.x' => ['nullable', 'numeric'],
            'changes.*.coordinates.y' => ['nullable', 'numeric'],
            'changes.*.coordinates.width' => ['nullable', 'numeric'],
            'changes.*.coordinates.height' => ['nullable', 'numeric'],
        ]);

        $targetDrawing = Drawing::findOrFail($validated['target_drawing_id']);
        $createdObservations = [];

        try {
            DB::beginTransaction();

            foreach ($validated['changes'] as $index => $change) {
                $coords = $change['coordinates'] ?? null;
                $pageNumber = $change['page_number'] ?? 1;

                $x = null;
                $y = null;

                if (is_array($coords) && isset($coords['x'], $coords['y'])) {
                    $x = (float) $coords['x'];
                    $y = (float) $coords['y'];

                    if (($x > 1 || $y > 1) && $x <= 100 && $y <= 100) {
                        $x = $x / 100;
                        $y = $y / 100;
                    }

                    $x = max(0, min(1, $x));
                    $y = max(0, min(1, $y));
                }

                $bboxWidth = null;
                $bboxHeight = null;
                if (is_array($coords) && isset($coords['width'], $coords['height'])) {
                    $bboxWidth = max(0.01, min(1, (float) $coords['width'] > 1 ? (float) $coords['width'] / 100 : (float) $coords['width']));
                    $bboxHeight = max(0.01, min(1, (float) $coords['height'] > 1 ? (float) $coords['height'] / 100 : (float) $coords['height']));
                }

                if ($x === null || $y === null) {
                    $x = min(0.1 + (($index % 4) * 0.2), 0.9);
                    $y = min(0.1 + (floor($index / 4) * 0.15), 0.9);
                }

                $observation = DrawingObservation::create([
                    'drawing_id' => $targetDrawing->id,
                    'page_number' => $pageNumber,
                    'x' => $x,
                    'y' => $y,
                    'bbox_width' => $bboxWidth,
                    'bbox_height' => $bboxHeight,
                    'type' => 'observation',
                    'description' => "[{$change['type']}] {$change['description']}\n\nLocation: {$change['location']}" .
                        ($change['reason'] ? "\n\nReason: {$change['reason']}" : ''),
                    'source' => 'ai_comparison',
                    'source_sheet_a_id' => $validated['drawing_a_id'],
                    'source_sheet_b_id' => $validated['drawing_b_id'],
                    'ai_change_type' => $change['type'],
                    'ai_impact' => $change['impact'],
                    'ai_location' => $change['location'],
                    'potential_change_order' => $change['potential_change_order'],
                    'is_confirmed' => false,
                ]);

                $createdObservations[] = $observation;
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => count($createdObservations) . ' observations created from AI comparison',
                'observations' => $createdObservations,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Failed to save observations: ' . $e->getMessage(),
            ], 500);
        }
    }

    // Alignment methods

    public function saveAlignment(Request $request, Drawing $drawing): JsonResponse
    {
        $validated = $request->validate([
            'candidate_drawing_id' => 'required|exists:drawings,id',
            'transform' => 'required|array',
            'transform.scale' => 'required|numeric',
            'transform.rotation' => 'required|numeric',
            'transform.translateX' => 'required|numeric',
            'transform.translateY' => 'required|numeric',
            'transform.cssTransform' => 'nullable|string',
            'method' => 'required|in:manual,auto',
            'alignment_points' => 'nullable|array',
        ]);

        try {
            $alignment = DrawingAlignment::saveAlignment(
                $drawing->id,
                $validated['candidate_drawing_id'],
                $validated['transform'],
                $validated['method'],
                $validated['alignment_points'] ?? null
            );

            return response()->json([
                'success' => true,
                'message' => 'Alignment saved',
                'alignment' => $alignment->toTransform(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to save alignment',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function getAlignment(Drawing $drawing, Drawing $candidateDrawing): JsonResponse
    {
        $alignment = DrawingAlignment::findForPair($drawing->id, $candidateDrawing->id);

        return response()->json([
            'success' => true,
            'alignment' => $alignment?->toTransform(),
        ]);
    }

    public function deleteAlignment(Drawing $drawing, Drawing $candidateDrawing): JsonResponse
    {
        $deleted = DrawingAlignment::where('base_drawing_id', $drawing->id)
            ->where('candidate_drawing_id', $candidateDrawing->id)
            ->delete();

        return response()->json([
            'success' => true,
            'deleted' => $deleted > 0,
        ]);
    }
}
