<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Traits\ProductionStatusTrait;
use App\Jobs\ExtractSheetMetadataJob;
use App\Jobs\ProcessDrawingJob;
use App\Models\Drawing;
use App\Models\DrawingMeasurement;
use App\Models\Location;
use App\Models\MeasurementSegmentStatus;
use App\Models\MeasurementStatus;
use App\Services\DrawingMetadataService;
use App\Services\DrawingProcessingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DrawingController extends Controller
{
    use ProductionStatusTrait;

    public function index(Request $request)
    {
        $query = Drawing::with(['observations.createdBy', 'createdBy', 'updatedBy']);

        if ($request->has('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        // By default, only show active revisions (not superseded/archived)
        if (! $request->has('include_all_revisions')) {
            $query->where(function ($q) {
                $q->where('status', Drawing::STATUS_ACTIVE)
                    ->orWhereNull('status');
            });
        }

        $drawings = $query->orderBy('created_at', 'desc')->get();

        return response()->json($drawings);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_id' => 'required|exists:locations,id',
            'file' => 'required|file|max:51200', // 50MB max
            'sheet_number' => 'sometimes|string|max:50',
            'title' => 'sometimes|string|max:255',
            'revision_number' => 'sometimes|string|max:20',
            'revision_date' => 'sometimes|date',
            'revision_notes' => 'sometimes|string',
        ]);

        $file = $request->file('file');
        $fileName = $file->getClientOriginalName();

        try {
            // Store file on S3
            $storagePath = $file->storeAs(
                'drawings/'.$validated['project_id'],
                time().'_'.$fileName,
                's3'
            );

            if (! $storagePath) {
                return response()->json(['message' => 'Failed to upload file.'], 500);
            }

            // Create the drawing record
            $drawing = Drawing::create([
                'project_id' => $validated['project_id'],
                'sheet_number' => $validated['sheet_number'] ?? null,
                'title' => $validated['title'] ?? pathinfo($fileName, PATHINFO_FILENAME),
                'storage_path' => $storagePath,
                'original_name' => $fileName,
                'mime_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
                'revision_number' => $validated['revision_number'] ?? null,
                'revision_date' => $validated['revision_date'] ?? null,
                'revision_notes' => $validated['revision_notes'] ?? null,
                'status' => Drawing::STATUS_DRAFT,
                'extraction_status' => Drawing::EXTRACTION_QUEUED,
            ]);

            // Handle revision chain if sheet_number provided
            if (! empty($validated['sheet_number'])) {
                Drawing::addRevision(
                    $validated['project_id'],
                    $validated['sheet_number'],
                    $drawing,
                    $validated['revision_number'] ?? null
                );
            }

            // Dispatch processing job
            ProcessDrawingJob::dispatch($drawing->id);

            // Dispatch metadata extraction
            ExtractSheetMetadataJob::dispatch($drawing->id);

            $drawing->load(['createdBy']);

            return response()->json($drawing, 201);
        } catch (\Exception $e) {
            Log::error('API upload error', ['error' => $e->getMessage()]);

            return response()->json(['message' => 'Failed to upload: '.$e->getMessage()], 500);
        }
    }

    public function show(Drawing $drawing)
    {
        $drawing->load([
            'project',
            'observations.createdBy',
            'observations.updatedBy',
            'previousRevision:id,title,revision_number',
            'createdBy',
            'updatedBy',
        ]);

        return response()->json($drawing);
    }

    public function update(Request $request, Drawing $drawing)
    {
        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'file' => 'sometimes|file|max:51200',
            'sheet_number' => 'sometimes|string|max:50',
            'revision_number' => 'sometimes|string|max:20',
            'revision_date' => 'sometimes|date',
            'revision_notes' => 'sometimes|string',
            'discipline' => 'sometimes|string|max:50',
            'status' => 'sometimes|in:draft,active,superseded,archived',
        ]);

        if ($request->hasFile('file')) {
            // When replacing file, create a NEW revision
            $file = $request->file('file');
            $fileName = $file->getClientOriginalName();

            $storagePath = $file->storeAs(
                'drawings/'.$drawing->project_id,
                time().'_'.$fileName,
                's3'
            );

            $newDrawing = Drawing::create([
                'project_id' => $drawing->project_id,
                'sheet_number' => $validated['sheet_number'] ?? $drawing->sheet_number,
                'title' => $validated['title'] ?? $drawing->title,
                'storage_path' => $storagePath,
                'original_name' => $fileName,
                'mime_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
                'revision_number' => $validated['revision_number'] ?? null,
                'revision_date' => $validated['revision_date'] ?? null,
                'revision_notes' => $validated['revision_notes'] ?? null,
                'discipline' => $validated['discipline'] ?? $drawing->discipline,
                'status' => Drawing::STATUS_DRAFT,
                'previous_revision_id' => $drawing->id,
                'extraction_status' => Drawing::EXTRACTION_QUEUED,
            ]);

            // Handle revision chain
            $sheetNumber = $validated['sheet_number'] ?? $drawing->sheet_number;
            if ($sheetNumber) {
                Drawing::addRevision(
                    $drawing->project_id,
                    $sheetNumber,
                    $newDrawing,
                    $validated['revision_number'] ?? null
                );
            }

            ProcessDrawingJob::dispatch($newDrawing->id);
            ExtractSheetMetadataJob::dispatch($newDrawing->id);

            $newDrawing->load(['createdBy', 'updatedBy']);

            return response()->json($newDrawing);
        }

        // Just updating metadata
        $drawing->update(array_filter([
            'title' => $validated['title'] ?? null,
            'sheet_number' => $validated['sheet_number'] ?? null,
            'revision_number' => $validated['revision_number'] ?? null,
            'revision_date' => $validated['revision_date'] ?? null,
            'revision_notes' => $validated['revision_notes'] ?? null,
            'discipline' => $validated['discipline'] ?? null,
            'status' => $validated['status'] ?? null,
        ]));

        $drawing->load(['createdBy', 'updatedBy']);

        return response()->json($drawing);
    }

    public function destroy(Drawing $drawing)
    {
        $drawing->delete();

        // If this was the active revision, promote previous
        if ($drawing->status === Drawing::STATUS_ACTIVE && $drawing->sheet_number && $drawing->project_id) {
            $previous = Drawing::where('project_id', $drawing->project_id)
                ->where('sheet_number', $drawing->sheet_number)
                ->where('id', '!=', $drawing->id)
                ->whereIn('status', [Drawing::STATUS_SUPERSEDED])
                ->orderBy('created_at', 'desc')
                ->first();

            if ($previous) {
                $previous->update(['status' => Drawing::STATUS_ACTIVE]);
            }
        }

        return response()->json(['message' => 'Drawing deleted successfully']);
    }

    /**
     * Stream the drawing file.
     */
    public function file(Drawing $drawing)
    {
        // Try S3 storage_path first
        if ($drawing->storage_path && Storage::disk('s3')->exists($drawing->storage_path)) {
            $stream = Storage::disk('s3')->readStream($drawing->storage_path);
            $size = Storage::disk('s3')->size($drawing->storage_path);

            return response()->stream(
                function () use ($stream) {
                    fpassthru($stream);
                    if (is_resource($stream)) {
                        fclose($stream);
                    }
                },
                200,
                [
                    'Content-Type' => $drawing->mime_type ?? 'application/octet-stream',
                    'Content-Length' => $size,
                    'Content-Disposition' => 'inline; filename="'.($drawing->original_name ?? 'drawing').'"',
                    'Cache-Control' => 'private, max-age=3600',
                ]
            );
        }

        // Fallback to local file_path
        if ($drawing->file_path && Storage::disk('public')->exists($drawing->file_path)) {
            return Storage::disk('public')->response(
                $drawing->file_path,
                $drawing->original_name ?? $drawing->file_name,
                ['Content-Type' => $drawing->mime_type ?? $drawing->file_type ?? 'application/octet-stream']
            );
        }

        return response()->json(['message' => 'File not found.'], 404);
    }

    /**
     * Get thumbnail image.
     */
    public function thumbnail(Drawing $drawing)
    {
        if ($drawing->thumbnail_path && Storage::disk('public')->exists($drawing->thumbnail_path)) {
            return Storage::disk('public')->response(
                $drawing->thumbnail_path,
                'thumbnail.png',
                ['Content-Type' => 'image/png']
            );
        }

        if ($drawing->thumbnail_s3_key && Storage::disk('s3')->exists($drawing->thumbnail_s3_key)) {
            $content = Storage::disk('s3')->get($drawing->thumbnail_s3_key);
            $mimeType = str_ends_with($drawing->thumbnail_s3_key, '.png') ? 'image/png' : 'image/jpeg';

            return response($content, 200, [
                'Content-Type' => $mimeType,
                'Cache-Control' => 'public, max-age=86400',
            ]);
        }

        return response()->json(['message' => 'Thumbnail not available.'], 404);
    }

    /**
     * Get diff image.
     */
    public function diff(Drawing $drawing)
    {
        if (! $drawing->diff_image_path || ! Storage::disk('public')->exists($drawing->diff_image_path)) {
            return response()->json(['message' => 'Diff image not available.'], 404);
        }

        return Storage::disk('public')->response(
            $drawing->diff_image_path,
            'diff.png',
            ['Content-Type' => 'image/png']
        );
    }

    /**
     * Get all revisions for a drawing's sheet_number.
     */
    public function revisions(Drawing $drawing)
    {
        if (! $drawing->sheet_number || ! $drawing->project_id) {
            return response()->json([
                'revisions' => [$drawing],
            ]);
        }

        $revisions = Drawing::where('project_id', $drawing->project_id)
            ->where('sheet_number', $drawing->sheet_number)
            ->select('id', 'sheet_number', 'title', 'revision_number', 'revision_date', 'status', 'created_at', 'thumbnail_path', 'thumbnail_s3_key')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'sheet_number' => $drawing->sheet_number,
            'revisions' => $revisions,
        ]);
    }

    /**
     * Compare two specific revisions.
     */
    public function compare(Request $request, Drawing $drawing)
    {
        $validated = $request->validate([
            'compare_to' => 'required|exists:drawings,id',
        ]);

        $otherDrawing = Drawing::find($validated['compare_to']);

        $service = app(DrawingProcessingService::class);

        $tempDrawing = new Drawing([
            'file_path' => $drawing->file_path,
            'previous_revision_id' => $otherDrawing->id,
        ]);
        $tempDrawing->id = $drawing->id;

        $result = $service->generateDiff($tempDrawing);

        if ($result['success']) {
            return Storage::disk('public')->response(
                $result['path'],
                'compare.png',
                ['Content-Type' => 'image/png']
            );
        }

        return response()->json(['message' => 'Failed to generate comparison.', 'error' => $result['error']], 500);
    }

    /**
     * Reprocess a drawing.
     */
    public function reprocess(Drawing $drawing)
    {
        ProcessDrawingJob::dispatch($drawing->id);

        return response()->json(['message' => 'Drawing queued for reprocessing']);
    }

    /**
     * Extract metadata using Textract.
     */
    public function extractMetadata(Drawing $drawing)
    {
        ExtractSheetMetadataJob::dispatch($drawing->id);

        return response()->json(['message' => 'Metadata extraction queued']);
    }

    /**
     * Confirm/update extracted metadata.
     */
    public function confirmMetadata(Request $request, Drawing $drawing, DrawingMetadataService $metadataService)
    {
        $validated = $request->validate([
            'sheet_number' => 'sometimes|string|max:50',
            'title' => 'sometimes|string|max:255',
            'revision' => 'sometimes|string|max:20',
            'revision_date' => 'sometimes|date',
            'discipline' => 'sometimes|string|max:50',
        ]);

        $success = $metadataService->confirmMetadata($drawing, $validated);

        if (! $success) {
            return response()->json(['message' => 'Failed to confirm metadata'], 500);
        }

        return response()->json([
            'message' => 'Metadata confirmed successfully',
            'drawing' => $drawing->fresh(),
        ]);
    }

    /**
     * Get extracted metadata for a drawing.
     */
    public function metadata(Drawing $drawing)
    {
        return response()->json([
            'has_metadata' => ! empty($drawing->drawing_number),
            'drawing_number' => $drawing->drawing_number,
            'drawing_title' => $drawing->drawing_title,
            'revision' => $drawing->revision,
            'extraction_status' => $drawing->extraction_status,
            'extraction_raw' => $drawing->extraction_raw,
            'extracted_at' => $drawing->extracted_at,
            'is_confirmed' => (bool) $drawing->metadata_confirmed,
        ]);
    }

    // =========================================================================
    // PRODUCTION
    // =========================================================================

    /**
     * Get full production data for a drawing (measurements, statuses, LCC summary).
     */
    public function production(Request $request, Drawing $drawing): JsonResponse
    {
        $workDate = $request->query('work_date', now()->toDateString());

        $measurements = DrawingMeasurement::where('drawing_id', $drawing->id)
            ->where('scope', 'takeoff')
            ->with(['condition.conditionLabourCodes.labourCostCode'])
            ->orderBy('created_at')
            ->get();

        $calibration = $drawing->scaleCalibration;

        $statuses = $this->buildStatusesForDate($measurements->pluck('id'), $workDate);
        $segmentStatuses = $this->buildAllSegmentStatusesForDate($measurements, $workDate);
        $lccSummary = $this->buildLccSummary($measurements, $statuses);

        return response()->json([
            'drawing' => $drawing->load('project'),
            'measurements' => $measurements,
            'calibration' => $calibration,
            'statuses' => $statuses,
            'segmentStatuses' => $segmentStatuses,
            'lccSummary' => array_values($lccSummary),
            'workDate' => $workDate,
        ]);
    }

    /**
     * Get production statuses for a specific work date (lightweight reload on date change).
     */
    public function productionStatuses(Request $request, Drawing $drawing): JsonResponse
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
     * Update percent complete for a single measurement / labour cost code pair.
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

        $measurements = DrawingMeasurement::where('drawing_id', $drawing->id)
            ->where('scope', 'takeoff')
            ->with(['condition.conditionLabourCodes.labourCostCode'])
            ->get();

        $allStatuses = $this->buildStatusesForDate($measurements->pluck('id'), $workDate);

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

        $allMeasurements = DrawingMeasurement::where('drawing_id', $drawing->id)
            ->where('scope', 'takeoff')
            ->with(['condition.conditionLabourCodes.labourCostCode'])
            ->get();

        $allStatuses = $this->buildStatusesForDate($allMeasurements->pluck('id'), $workDate);

        $this->syncProductionToBudget($drawing, $workDate);

        return response()->json([
            'success' => true,
            'updated_count' => $measurements->count(),
            'lccSummary' => array_values($this->buildLccSummary($allMeasurements, $allStatuses)),
        ]);
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

        $points = $measurement->points ?? [];
        $maxIndex = count($points) - 2;
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

        $this->syncSegmentToMeasurementStatus($measurement, $validated['labour_cost_code_id'], $workDate);

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

        foreach (array_keys($affectedMeasurementIds) as $measId) {
            $m = $measurements[$measId] ?? null;
            if ($m) {
                $this->syncSegmentToMeasurementStatus($m, $lccId, $workDate);
            }
        }

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
     * Serve a drawing tile for the map viewer.
     */
    public function tile(Drawing $drawing, int $z, string $coords)
    {
        if (! $drawing->tiles_base_url) {
            abort(404);
        }

        $tilePath = "{$drawing->tiles_base_url}/{$z}/{$coords}.png";
        $disk = config('filesystems.drawings_disk', 'public');

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

        try {
            $stream = Storage::disk($disk)->readStream($tilePath);
            if ($stream) {
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
                        'Cache-Control' => 'public, max-age=86400',
                    ]
                );
            }
        } catch (\Exception $e) {
            // fall through to 404
        }

        abort(404);
    }

    /**
     * Serve the high-res page preview image.
     */
    public function preview(Drawing $drawing)
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
}
