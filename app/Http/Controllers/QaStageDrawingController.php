<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessDrawingJob;
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
        $directory = 'qa-drawings/' . $qaStage->id;

        try {
            // Store file locally in public storage
            $filePath = $file->storeAs($directory, time() . '_' . $fileName, 'public');

            if (!$filePath) {
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
                        ? $validated['name'] . " — Page {$page}"
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
            return redirect()->back()->with('error', 'Failed to upload: ' . $e->getMessage());
        }
    }

    /**
     * Resolve or create a DrawingSheet for the upload.
     */
    private function resolveDrawingSheet(QaStage $qaStage, array $validated): DrawingSheet
    {
        if (!empty($validated['drawing_sheet_id'])) {
            return DrawingSheet::find($validated['drawing_sheet_id']);
        }

        if (!empty($validated['sheet_number'])) {
            return DrawingSheet::findOrCreateBySheetNumber(
                $qaStage->id,
                $validated['sheet_number'],
                $validated['name']
            );
        }

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
            $dimensions = $processingService->extractPageDimensions($filePath);
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

        if (!$storagePath) {
            return redirect()->back()->with('error', 'No file associated with this drawing.');
        }

        $path = Storage::disk('public')->path($storagePath);

        if (!file_exists($path)) {
            return redirect()->back()->with('error', 'File not found.');
        }

        return response()->download($path, $fileName);
    }

    public function show(QaStageDrawing $drawing)
    {
        $drawing->load([
            'qaStage.location',
            'drawingFile',
            'drawingSheet.revisions' => function ($query) {
                $query->select('id', 'drawing_sheet_id', 'drawing_file_id', 'page_number', 'name', 'revision_number', 'revision_date', 'status', 'created_at', 'thumbnail_path', 'file_path', 'diff_image_path')
                    ->orderBy('created_at', 'desc');
            },
            'previousRevision:id,name,revision_number,file_path,thumbnail_path',
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
        }

        return Inertia::render('qa-stages/drawings/show', [
            'drawing' => $drawing,
            'siblingPages' => $siblingPages,
        ]);
    }

    /**
     * Extract metadata from drawing using AI
     */
    public function extractMetadata(QaStageDrawing $drawing, DrawingMetadataService $metadataService)
    {
        $result = $metadataService->extractMetadata($drawing);

        if (!$result['success']) {
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
}
