<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessDrawingJob;
use App\Models\DrawingAlignment;
use App\Models\DrawingFile;
use App\Models\DrawingSheet;
use App\Models\QaStage;
use App\Models\QaStageDrawing;
use App\Services\DrawingMetadataService;
use App\Services\DrawingProcessingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class QaStageDrawingController extends Controller
{
    public function store(Request $request, QaStage $qaStage)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'file' => 'required|file|max:51200', // 50MB max
            // Optional revision fields
            'drawing_sheet_id' => 'sometimes|exists:drawing_sheets,id',
            'sheet_number' => 'sometimes|string|max:50',
            'revision_number' => 'sometimes|string|max:20',
        ]);

        $file = $request->file('file');
        $fileName = $file->getClientOriginalName();
        $directory = 'qa-drawings/'.$qaStage->id;

        try {
            // Store file locally in public storage
            $filePath = $file->storeAs($directory, time().'_'.$fileName, 'public');

            if (! $filePath) {
                Log::error('Failed to upload file', ['fileName' => $fileName]);

                return redirect()->back()->with('error', 'Failed to upload file.');
            }

            // Calculate file hash for deduplication
            $fullPath = Storage::disk('public')->path($filePath);
            $sha256 = hash_file('sha256', $fullPath);

            // Determine page count
            $pageCount = $this->getPageCount($fullPath, $file->getClientMimeType());

            // Use transaction for atomic creation of file + pages
            $firstDrawing = DB::transaction(function () use (
                $qaStage, $validated, $filePath, $fileName, $file, $sha256, $pageCount
            ) {
                // Create the DrawingFile record
                $drawingFile = DrawingFile::create([
                    'qa_stage_id' => $qaStage->id,
                    'storage_path' => $filePath,
                    'original_name' => $fileName,
                    'mime_type' => $file->getClientMimeType(),
                    'file_size' => $file->getSize(),
                    'sha256' => $sha256,
                    'page_count' => $pageCount,
                    'created_by' => auth()->id(),
                ]);

                // Determine or create the drawing sheet
                $drawingSheet = $this->resolveDrawingSheet($qaStage, $validated);

                // Create drawing records for each page
                $firstDrawing = null;
                for ($page = 1; $page <= $pageCount; $page++) {
                    $pageName = $pageCount > 1
                        ? $validated['name']." — Page {$page}"
                        : $validated['name'];

                    $drawing = QaStageDrawing::create([
                        'qa_stage_id' => $qaStage->id,
                        'drawing_sheet_id' => $drawingSheet->id,
                        'drawing_file_id' => $drawingFile->id,
                        'page_number' => $page,
                        'name' => $pageName,
                        'revision_number' => $validated['revision_number'] ?? null,
                        'status' => QaStageDrawing::STATUS_DRAFT,
                        // Legacy fields for backwards compatibility
                        'file_path' => $filePath,
                        'file_name' => $fileName,
                        'file_type' => $file->getClientMimeType(),
                        'file_size' => $file->getSize(),
                    ]);

                    if ($page === 1) {
                        $firstDrawing = $drawing;
                        // Add first page as revision to sheet
                        $drawingSheet->addRevision($drawing, $validated['revision_number'] ?? null);
                    }
                }

                return $firstDrawing;
            });

            // Dispatch async processing job for thumbnail/diff generation
            ProcessDrawingJob::dispatch($firstDrawing->id);

            $message = $pageCount > 1
                ? "Drawing uploaded successfully ({$pageCount} pages created). Processing in background..."
                : 'Drawing uploaded successfully. Processing in background...';

            return redirect()->back()->with('success', $message);
        } catch (\Exception $e) {
            Log::error('Upload error', ['error' => $e->getMessage()]);

            return redirect()->back()->with('error', 'Failed to upload: '.$e->getMessage());
        }
    }

    /**
     * Resolve or create a DrawingSheet for the upload.
     */
    private function resolveDrawingSheet(QaStage $qaStage, array $validated): DrawingSheet
    {
        // If explicit drawing_sheet_id provided, use it
        if (! empty($validated['drawing_sheet_id'])) {
            return DrawingSheet::find($validated['drawing_sheet_id']);
        }

        // If sheet_number provided, find or create by sheet number
        if (! empty($validated['sheet_number'])) {
            return DrawingSheet::findOrCreateBySheetNumber(
                $qaStage->id,
                $validated['sheet_number'],
                $validated['name']
            );
        }

        // Try to find existing sheet by title (name) within same QA stage
        // This allows uploading new revisions with the same name to group them together
        $existingSheet = DrawingSheet::where('qa_stage_id', $qaStage->id)
            ->where('title', $validated['name'])
            ->first();

        if ($existingSheet) {
            return $existingSheet;
        }

        // No match found - create new sheet
        return DrawingSheet::create([
            'qa_stage_id' => $qaStage->id,
            'title' => $validated['name'],
            'revision_count' => 0,
        ]);
    }

    /**
     * Get page count from a file.
     */
    private function getPageCount(string $filePath, ?string $mimeType): int
    {
        try {
            $processingService = app(DrawingProcessingService::class);
            $dimensions = $processingService->extractPageDimensionsFromPath($filePath);

            return $dimensions['pages'] ?? 1;
        } catch (\Exception $e) {
            Log::warning("Could not determine page count: {$e->getMessage()}");

            // Default to 1 page if we can't determine
            return 1;
        }
    }

    public function destroy(QaStageDrawing $drawing)
    {
        // Soft delete - keep files for revision history
        $drawing->delete();

        // If this was the current revision, update sheet to point to previous
        if ($drawing->drawingSheet && $drawing->drawingSheet->current_revision_id === $drawing->id) {
            $previousActive = $drawing->drawingSheet->revisions()
                ->where('id', '!=', $drawing->id)
                ->whereIn('status', [QaStageDrawing::STATUS_ACTIVE, QaStageDrawing::STATUS_SUPERSEDED])
                ->orderBy('created_at', 'desc')
                ->first();

            if ($previousActive) {
                $previousActive->makeActive();
            } else {
                $drawing->drawingSheet->update(['current_revision_id' => null]);
            }
        }

        return redirect()->back()->with('success', 'Drawing deleted successfully.');
    }

    public function download(QaStageDrawing $drawing)
    {
        // Prefer DrawingFile, fall back to legacy file_path
        $storagePath = $drawing->drawingFile?->storage_path ?? $drawing->file_path;
        $fileName = $drawing->drawingFile?->original_name ?? $drawing->file_name;

        if (! $storagePath) {
            return redirect()->back()->with('error', 'No file associated with this drawing.');
        }

        // Try local public disk first, then S3
        if (Storage::disk('public')->exists($storagePath)) {
            $path = Storage::disk('public')->path($storagePath);

            return response()->download($path, $fileName);
        }

        if (Storage::disk('s3')->exists($storagePath)) {
            $stream = Storage::disk('s3')->readStream($storagePath);
            $size = Storage::disk('s3')->size($storagePath);
            $mimeType = $drawing->drawingFile?->mime_type ?? $drawing->file_type ?? 'application/octet-stream';

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
                    'Content-Disposition' => 'attachment; filename="'.$fileName.'"',
                ]
            );
        }

        return redirect()->back()->with('error', 'File not found.');
    }

    /**
     * Serve a drawing file inline (for PDF viewer / image display).
     * Streams from local public disk or S3.
     */
    public function serveFile(QaStageDrawing $drawing)
    {
        $storagePath = $drawing->drawingFile?->storage_path ?? $drawing->file_path;
        $fileName = $drawing->drawingFile?->original_name ?? $drawing->file_name ?? 'drawing.pdf';
        $mimeType = $drawing->drawingFile?->mime_type ?? $drawing->file_type ?? 'application/pdf';

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
                    'Content-Disposition' => 'inline; filename="'.$fileName.'"',
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
                    'Content-Disposition' => 'inline; filename="'.$fileName.'"',
                    'Cache-Control' => 'private, max-age=3600',
                ]
            );
        }

        abort(404, 'File not found.');
    }

    /**
     * Serve a drawing thumbnail inline.
     */
    public function serveThumbnail(QaStageDrawing $drawing)
    {
        $thumbnailPath = $drawing->thumbnail_path;

        if (! $thumbnailPath) {
            abort(404, 'No thumbnail available.');
        }

        // Try local public disk first
        if (Storage::disk('public')->exists($thumbnailPath)) {
            $stream = Storage::disk('public')->readStream($thumbnailPath);
            $size = Storage::disk('public')->size($thumbnailPath);
            $mimeType = Storage::disk('public')->mimeType($thumbnailPath) ?: 'image/png';

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

        // Try S3
        if (Storage::disk('s3')->exists($thumbnailPath)) {
            $stream = Storage::disk('s3')->readStream($thumbnailPath);
            $size = Storage::disk('s3')->size($thumbnailPath);
            $mimeType = Storage::disk('s3')->mimeType($thumbnailPath) ?: 'image/png';

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

    public function show(QaStageDrawing $drawing)
    {
        $drawing->load([
            'qaStage.location',
            'drawingSet.project', // For drawings from drawing sets
            'drawingFile',
            'drawingSheet.revisions' => function ($query) {
                $query->select(
                    'id', 'drawing_sheet_id', 'drawing_file_id', 'drawing_set_id',
                    'page_number', 'name', 'revision_number', 'revision_date', 'status',
                    'created_at', 'thumbnail_path', 'file_path', 'diff_image_path',
                    'page_preview_s3_key', 'drawing_number', 'drawing_title', 'revision'
                )->orderBy('created_at', 'desc');
            },
            'drawingSheet.project', // For project-level sheets
            'previousRevision:id,name,revision_number,file_path,thumbnail_path,page_preview_s3_key',
            'createdBy',
            'observations.createdBy',
        ]);

        // Get sibling pages from the same file (for multi-page navigation)
        $siblingPages = [];
        if ($drawing->drawing_file_id) {
            $siblingPages = QaStageDrawing::where('drawing_file_id', $drawing->drawing_file_id)
                ->select('id', 'page_number', 'page_label', 'name')
                ->orderBy('page_number')
                ->get();
        } elseif ($drawing->drawing_set_id) {
            // For drawing sets, sibling pages are other pages from the same PDF
            $siblingPages = QaStageDrawing::where('drawing_set_id', $drawing->drawing_set_id)
                ->select('id', 'page_number', 'drawing_number', 'drawing_title', 'revision')
                ->orderBy('page_number')
                ->get()
                ->map(function ($page) {
                    return [
                        'id' => $page->id,
                        'page_number' => $page->page_number,
                        'page_label' => null,
                        'name' => $page->drawing_number
                            ? "{$page->drawing_number} - {$page->drawing_title}"
                            : "Page {$page->page_number}",
                    ];
                });
        }

        // Determine project for breadcrumbs
        $project = $drawing->qaStage?->location
            ?? $drawing->drawingSet?->project
            ?? $drawing->drawingSheet?->project;

        return Inertia::render('qa-stages/drawings/show', [
            'drawing' => $drawing,
            'siblingPages' => $siblingPages,
            'project' => $project,
        ]);
    }

    /**
     * Extract metadata from drawing using AI
     */
    public function extractMetadata(QaStageDrawing $drawing, DrawingMetadataService $metadataService)
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
     * Save alignment between two drawings.
     */
    public function saveAlignment(Request $request, QaStageDrawing $drawing)
    {
        $validated = $request->validate([
            'candidate_drawing_id' => 'required|exists:qa_stage_drawings,id',
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
            Log::error('Failed to save alignment', [
                'base_drawing_id' => $drawing->id,
                'candidate_drawing_id' => $validated['candidate_drawing_id'],
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to save alignment',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get saved alignment for a drawing pair.
     */
    public function getAlignment(QaStageDrawing $drawing, QaStageDrawing $candidateDrawing)
    {
        $alignment = DrawingAlignment::findForPair($drawing->id, $candidateDrawing->id);

        if (! $alignment) {
            return response()->json([
                'success' => true,
                'alignment' => null,
            ]);
        }

        return response()->json([
            'success' => true,
            'alignment' => $alignment->toTransform(),
        ]);
    }

    /**
     * Delete alignment for a drawing pair.
     */
    public function deleteAlignment(QaStageDrawing $drawing, QaStageDrawing $candidateDrawing)
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
