<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessDrawingJob;
use App\Models\Drawing;
use App\Models\DrawingAlignment;
use App\Models\DrawingObservation;
use App\Models\Location;
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
        $drawing->load([
            'project:id,name',
            'previousRevision:id,sheet_number,revision_number,thumbnail_path,thumbnail_s3_key,page_preview_s3_key',
            'createdBy',
            'observations.createdBy',
        ]);

        // Get revision history for same sheet
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

        return Inertia::render('drawings/show', [
            'drawing' => $drawing,
            'revisions' => $revisions,
            'project' => $drawing->project,
        ]);
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
     */
    public function serveTile(Drawing $drawing, int $z, string $coords)
    {
        if (! $drawing->tiles_base_url) {
            abort(404);
        }

        $tilePath = "{$drawing->tiles_base_url}/{$z}/{$coords}.jpg";
        $disk = config('filesystems.drawings_disk', 'public');

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
                        'Content-Type' => 'image/jpeg',
                        'Content-Length' => $size,
                        'Cache-Control' => 'public, max-age=604800',
                    ]
                );
            }
        } catch (\Exception $e) {
            // Tile not found on configured disk
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
