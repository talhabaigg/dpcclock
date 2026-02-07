<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessDrawingJob;
use App\Models\DrawingSheet;
use App\Models\QaStageDrawing;
use App\Services\DrawingMetadataService;
use App\Services\DrawingProcessingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class QaStageDrawingController extends Controller
{
    public function index(Request $request)
    {
        $query = QaStageDrawing::with(['qaStage', 'drawingSheet', 'observations.createdBy', 'createdBy', 'updatedBy']);

        if ($request->has('qa_stage_id')) {
            $query->where('qa_stage_id', $request->qa_stage_id);
        }

        // By default, only show active revisions (not superseded/archived)
        if (! $request->has('include_all_revisions')) {
            $query->where(function ($q) {
                $q->where('status', QaStageDrawing::STATUS_ACTIVE)
                    ->orWhereNull('status'); // Backward compatibility
            });
        }

        $drawings = $query->orderBy('created_at', 'desc')->get();

        return response()->json($drawings);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'qa_stage_id' => 'required|exists:qa_stages,id',
            'name' => 'required|string|max:255',
            'file' => 'required|file|max:51200', // 50MB max
            // Optional: for revision uploads
            'drawing_sheet_id' => 'sometimes|exists:drawing_sheets,id',
            'sheet_number' => 'sometimes|string|max:50',
            'revision_number' => 'sometimes|string|max:20',
            'revision_date' => 'sometimes|date',
            'revision_notes' => 'sometimes|string',
        ]);

        $file = $request->file('file');
        $fileName = $file->getClientOriginalName();
        $directory = 'qa-drawings/'.$validated['qa_stage_id'];

        try {
            $filePath = $file->storeAs($directory, time().'_'.$fileName, 'public');

            if (! $filePath) {
                Log::error('Failed to upload file', ['fileName' => $fileName]);

                return response()->json(['message' => 'Failed to upload file.'], 500);
            }

            // Determine or create the drawing sheet
            $drawingSheet = null;
            if (! empty($validated['drawing_sheet_id'])) {
                // Adding revision to existing sheet
                $drawingSheet = DrawingSheet::find($validated['drawing_sheet_id']);
            } elseif (! empty($validated['sheet_number'])) {
                // Find or create sheet by sheet number
                $drawingSheet = DrawingSheet::findOrCreateBySheetNumber(
                    $validated['qa_stage_id'],
                    $validated['sheet_number'],
                    $validated['name']
                );
            } else {
                // Create new sheet for this drawing
                $drawingSheet = DrawingSheet::create([
                    'qa_stage_id' => $validated['qa_stage_id'],
                    'title' => $validated['name'],
                    'revision_count' => 0,
                ]);
            }

            // Create the drawing record
            $drawing = QaStageDrawing::create([
                'qa_stage_id' => $validated['qa_stage_id'],
                'drawing_sheet_id' => $drawingSheet->id,
                'name' => $validated['name'],
                'revision_number' => $validated['revision_number'] ?? null,
                'revision_date' => $validated['revision_date'] ?? null,
                'revision_notes' => $validated['revision_notes'] ?? null,
                'status' => QaStageDrawing::STATUS_DRAFT,
                'file_path' => $filePath,
                'file_name' => $fileName,
                'file_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
            ]);

            // Add as revision to sheet (handles revision numbering and status)
            $drawingSheet->addRevision($drawing, $validated['revision_number'] ?? null);

            // Dispatch async processing job
            ProcessDrawingJob::dispatch($drawing->id);

            $drawing->load(['qaStage', 'drawingSheet', 'createdBy']);

            return response()->json($drawing, 201);
        } catch (\Exception $e) {
            Log::error('Upload error', ['error' => $e->getMessage()]);

            return response()->json(['message' => 'Failed to upload: '.$e->getMessage()], 500);
        }
    }

    public function show(QaStageDrawing $qaStageDrawing)
    {
        $qaStageDrawing->load([
            'qaStage.location',
            'drawingSheet.revisions' => function ($query) {
                $query->select('id', 'drawing_sheet_id', 'revision_number', 'revision_date', 'status', 'created_at')
                    ->orderBy('created_at', 'desc');
            },
            'observations.createdBy',
            'observations.updatedBy',
            'previousRevision:id,name,revision_number',
            'createdBy',
            'updatedBy',
        ]);

        return response()->json($qaStageDrawing);
    }

    public function file(Request $request, QaStageDrawing $qaStageDrawing)
    {
        Log::info('File download requested', [
            'drawing_id' => $qaStageDrawing->id,
            'drawing_set_id' => $qaStageDrawing->drawing_set_id,
            'drawing_file_id' => $qaStageDrawing->drawing_file_id,
            'file_path' => $qaStageDrawing->file_path,
            'user_id' => $request->user()?->id,
        ]);

        // 1. DrawingSet-based (S3 PDF) — stream the original PDF from S3
        if ($qaStageDrawing->drawing_set_id) {
            $drawingSet = $qaStageDrawing->drawingSet;
            if ($drawingSet && $drawingSet->original_pdf_s3_key) {
                $stream = Storage::disk('s3')->readStream($drawingSet->original_pdf_s3_key);
                if (! $stream) {
                    return response()->json(['message' => 'Could not read PDF from storage.'], 404);
                }

                $size = Storage::disk('s3')->size($drawingSet->original_pdf_s3_key);
                $filename = $drawingSet->original_filename ?? 'drawing.pdf';

                return response()->stream(
                    function () use ($stream) {
                        fpassthru($stream);
                        if (is_resource($stream)) {
                            fclose($stream);
                        }
                    },
                    200,
                    [
                        'Content-Type' => 'application/pdf',
                        'Content-Length' => $size,
                        'Content-Disposition' => 'inline; filename="'.$filename.'"',
                        'Cache-Control' => 'private, max-age=3600',
                    ]
                );
            }
        }

        // 2. DrawingFile-based — serve from public disk via storage_path
        if ($qaStageDrawing->drawing_file_id) {
            $drawingFile = $qaStageDrawing->drawingFile;
            if ($drawingFile && $drawingFile->storage_path && Storage::disk('public')->exists($drawingFile->storage_path)) {
                return Storage::disk('public')->response(
                    $drawingFile->storage_path,
                    $drawingFile->original_name,
                    ['Content-Type' => $drawingFile->mime_type ?? 'application/octet-stream']
                );
            }
        }

        // 3. Legacy file_path — serve directly from public disk
        if ($qaStageDrawing->file_path && Storage::disk('public')->exists($qaStageDrawing->file_path)) {
            return Storage::disk('public')->response(
                $qaStageDrawing->file_path,
                $qaStageDrawing->file_name,
                ['Content-Type' => $qaStageDrawing->file_type ?? 'application/octet-stream']
            );
        }

        Log::error('File not found for drawing', [
            'drawing_id' => $qaStageDrawing->id,
            'drawing_set_id' => $qaStageDrawing->drawing_set_id,
            'drawing_file_id' => $qaStageDrawing->drawing_file_id,
            'file_path' => $qaStageDrawing->file_path,
        ]);

        return response()->json(['message' => 'File not found.'], 404);
    }

    /**
     * Get thumbnail image for a drawing
     */
    public function thumbnail(QaStageDrawing $qaStageDrawing)
    {
        // Try local thumbnail first
        if ($qaStageDrawing->thumbnail_path && Storage::disk('public')->exists($qaStageDrawing->thumbnail_path)) {
            return Storage::disk('public')->response(
                $qaStageDrawing->thumbnail_path,
                'thumbnail.png',
                ['Content-Type' => 'image/png']
            );
        }

        // Fall back to S3 thumbnail (from drawing set processing)
        if ($qaStageDrawing->thumbnail_s3_key && Storage::disk('s3')->exists($qaStageDrawing->thumbnail_s3_key)) {
            $url = Storage::disk('s3')->temporaryUrl(
                $qaStageDrawing->thumbnail_s3_key,
                now()->addMinutes(5)
            );

            return redirect($url);
        }

        return response()->json(['message' => 'Thumbnail not available.'], 404);
    }

    /**
     * Get diff image comparing this revision to previous
     */
    public function diff(QaStageDrawing $qaStageDrawing)
    {
        if (! $qaStageDrawing->diff_image_path || ! Storage::disk('public')->exists($qaStageDrawing->diff_image_path)) {
            return response()->json(['message' => 'Diff image not available.'], 404);
        }

        return Storage::disk('public')->response(
            $qaStageDrawing->diff_image_path,
            'diff.png',
            ['Content-Type' => 'image/png']
        );
    }

    /**
     * Compare two specific revisions
     */
    public function compare(Request $request, QaStageDrawing $qaStageDrawing)
    {
        $validated = $request->validate([
            'compare_to' => 'required|exists:qa_stage_drawings,id',
        ]);

        $otherDrawing = QaStageDrawing::find($validated['compare_to']);

        // Ensure both drawings belong to same sheet
        if ($qaStageDrawing->drawing_sheet_id !== $otherDrawing->drawing_sheet_id) {
            return response()->json(['message' => 'Cannot compare drawings from different sheets.'], 400);
        }

        // Generate diff on the fly if needed
        $service = app(DrawingProcessingService::class);

        // Create a temporary "virtual" drawing to generate the diff
        $tempDrawing = new QaStageDrawing([
            'file_path' => $qaStageDrawing->file_path,
            'previous_revision_id' => $otherDrawing->id,
        ]);
        $tempDrawing->id = $qaStageDrawing->id;

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
     * Get all revisions for a drawing's sheet
     */
    public function revisions(QaStageDrawing $qaStageDrawing)
    {
        if (! $qaStageDrawing->drawing_sheet_id) {
            return response()->json([
                'sheet' => null,
                'revisions' => [$qaStageDrawing],
            ]);
        }

        $sheet = $qaStageDrawing->drawingSheet;
        $revisions = $sheet->revisions()
            ->select('id', 'drawing_sheet_id', 'name', 'revision_number', 'revision_date', 'status', 'file_name', 'created_at', 'thumbnail_path')
            ->get();

        return response()->json([
            'sheet' => $sheet,
            'revisions' => $revisions,
            'current_revision_id' => $sheet->current_revision_id,
        ]);
    }

    public function update(Request $request, QaStageDrawing $qaStageDrawing)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'file' => 'sometimes|file|max:51200',
            'revision_number' => 'sometimes|string|max:20',
            'revision_date' => 'sometimes|date',
            'revision_notes' => 'sometimes|string',
            'status' => 'sometimes|in:draft,active,superseded,archived',
        ]);

        if ($request->hasFile('file')) {
            // When replacing file, this creates a NEW revision
            // Don't delete old file - it's part of revision history
            $file = $request->file('file');
            $fileName = $file->getClientOriginalName();
            $directory = 'qa-drawings/'.$qaStageDrawing->qa_stage_id;

            $filePath = $file->storeAs($directory, time().'_'.$fileName, 'public');

            // Create new revision instead of updating
            $newDrawing = QaStageDrawing::create([
                'qa_stage_id' => $qaStageDrawing->qa_stage_id,
                'drawing_sheet_id' => $qaStageDrawing->drawing_sheet_id,
                'name' => $validated['name'] ?? $qaStageDrawing->name,
                'revision_number' => $validated['revision_number'] ?? null,
                'revision_date' => $validated['revision_date'] ?? null,
                'revision_notes' => $validated['revision_notes'] ?? null,
                'status' => QaStageDrawing::STATUS_DRAFT,
                'file_path' => $filePath,
                'file_name' => $fileName,
                'file_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
                'previous_revision_id' => $qaStageDrawing->id,
            ]);

            // Update sheet
            if ($qaStageDrawing->drawingSheet) {
                $qaStageDrawing->drawingSheet->addRevision($newDrawing);
            }

            // Dispatch processing
            ProcessDrawingJob::dispatch($newDrawing->id);

            $newDrawing->load(['qaStage', 'drawingSheet', 'createdBy', 'updatedBy']);

            return response()->json($newDrawing);
        } else {
            // Just updating metadata, not file
            $qaStageDrawing->update(array_filter([
                'name' => $validated['name'] ?? null,
                'revision_number' => $validated['revision_number'] ?? null,
                'revision_date' => $validated['revision_date'] ?? null,
                'revision_notes' => $validated['revision_notes'] ?? null,
                'status' => $validated['status'] ?? null,
            ]));
        }

        $qaStageDrawing->load(['qaStage', 'drawingSheet', 'createdBy', 'updatedBy']);

        return response()->json($qaStageDrawing);
    }

    public function destroy(QaStageDrawing $qaStageDrawing)
    {
        // Soft delete - don't actually remove files
        // Files are kept for revision history
        $qaStageDrawing->delete();

        // If this was the current revision, update sheet to point to previous
        if ($qaStageDrawing->drawingSheet && $qaStageDrawing->drawingSheet->current_revision_id === $qaStageDrawing->id) {
            $previousActive = $qaStageDrawing->drawingSheet->revisions()
                ->where('id', '!=', $qaStageDrawing->id)
                ->whereIn('status', [QaStageDrawing::STATUS_ACTIVE, QaStageDrawing::STATUS_SUPERSEDED])
                ->orderBy('created_at', 'desc')
                ->first();

            if ($previousActive) {
                $previousActive->makeActive();
            } else {
                $qaStageDrawing->drawingSheet->update(['current_revision_id' => null]);
            }
        }

        return response()->json(['message' => 'Drawing deleted successfully']);
    }

    /**
     * Reprocess a drawing (regenerate thumbnail/diff)
     */
    public function reprocess(QaStageDrawing $qaStageDrawing)
    {
        ProcessDrawingJob::dispatch($qaStageDrawing->id);

        return response()->json(['message' => 'Drawing queued for reprocessing']);
    }

    /**
     * Extract metadata from drawing using AI
     */
    public function extractMetadata(QaStageDrawing $qaStageDrawing, DrawingMetadataService $metadataService)
    {
        $result = $metadataService->extractMetadata($qaStageDrawing);

        if (! $result['success']) {
            return response()->json([
                'message' => 'Metadata extraction failed',
                'error' => $result['error'] ?? 'Unknown error',
            ], 500);
        }

        return response()->json([
            'message' => 'Metadata extracted successfully',
            'metadata' => $result['metadata'],
            'confidence' => $result['confidence'],
        ]);
    }

    /**
     * Confirm/update AI-extracted metadata
     */
    public function confirmMetadata(Request $request, QaStageDrawing $qaStageDrawing, DrawingMetadataService $metadataService)
    {
        $validated = $request->validate([
            'sheet_number' => 'sometimes|string|max:50',
            'title' => 'sometimes|string|max:255',
            'revision' => 'sometimes|string|max:20',
            'revision_date' => 'sometimes|date',
            'discipline' => 'sometimes|string|max:50',
        ]);

        $success = $metadataService->confirmMetadata($qaStageDrawing, $validated);

        if (! $success) {
            return response()->json(['message' => 'Failed to confirm metadata'], 500);
        }

        $qaStageDrawing->load(['drawingSheet', 'qaStage']);

        return response()->json([
            'message' => 'Metadata confirmed successfully',
            'drawing' => $qaStageDrawing,
        ]);
    }

    /**
     * Get AI-extracted metadata for a drawing
     */
    public function metadata(QaStageDrawing $qaStageDrawing)
    {
        $extractedMetadata = $qaStageDrawing->ai_extracted_metadata;

        if (! $extractedMetadata) {
            return response()->json([
                'message' => 'No metadata has been extracted for this drawing',
                'has_metadata' => false,
            ], 404);
        }

        return response()->json([
            'has_metadata' => true,
            'metadata' => $extractedMetadata['parsed'] ?? null,
            'raw_response' => $extractedMetadata['raw_response'] ?? null,
            'extracted_at' => $extractedMetadata['extracted_at'] ?? null,
            'model' => $extractedMetadata['model'] ?? null,
            'is_confirmed' => $qaStageDrawing->drawingSheet?->metadata_confirmed ?? false,
        ]);
    }

    private function corsHeaders(Request $request): array
    {
        $origin = $request->header('Origin', '*');

        return [
            'Access-Control-Allow-Origin' => $origin,
            'Access-Control-Allow-Credentials' => 'true',
            'Access-Control-Allow-Methods' => 'GET, OPTIONS',
            'Access-Control-Allow-Headers' => 'Authorization, Content-Type, X-Requested-With',
        ];
    }
}
