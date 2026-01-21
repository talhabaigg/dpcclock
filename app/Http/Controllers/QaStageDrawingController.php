<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessDrawingJob;
use App\Models\DrawingSheet;
use App\Models\QaStage;
use App\Models\QaStageDrawing;
use App\Services\DrawingMetadataService;
use Illuminate\Http\Request;
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

            // Determine or create the drawing sheet
            $drawingSheet = null;
            if (!empty($validated['drawing_sheet_id'])) {
                // Adding revision to existing sheet
                $drawingSheet = DrawingSheet::find($validated['drawing_sheet_id']);
            } elseif (!empty($validated['sheet_number'])) {
                // Find or create sheet by sheet number
                $drawingSheet = DrawingSheet::findOrCreateBySheetNumber(
                    $qaStage->id,
                    $validated['sheet_number'],
                    $validated['name']
                );
            } else {
                // Create new sheet for this drawing
                $drawingSheet = DrawingSheet::create([
                    'qa_stage_id' => $qaStage->id,
                    'title' => $validated['name'],
                    'revision_count' => 0,
                ]);
            }

            // Create the drawing record
            $drawing = QaStageDrawing::create([
                'qa_stage_id' => $qaStage->id,
                'drawing_sheet_id' => $drawingSheet->id,
                'name' => $validated['name'],
                'revision_number' => $validated['revision_number'] ?? null,
                'status' => QaStageDrawing::STATUS_DRAFT,
                'file_path' => $filePath,
                'file_name' => $fileName,
                'file_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
            ]);

            // Add as revision to sheet (handles revision numbering and status)
            $drawingSheet->addRevision($drawing, $validated['revision_number'] ?? null);

            // Dispatch async processing job for thumbnail/diff generation
            ProcessDrawingJob::dispatch($drawing->id);

            return redirect()->back()->with('success', 'Drawing uploaded successfully. Processing in background...');
        } catch (\Exception $e) {
            Log::error('Upload error', ['error' => $e->getMessage()]);
            return redirect()->back()->with('error', 'Failed to upload: ' . $e->getMessage());
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
        $path = Storage::disk('public')->path($drawing->file_path);

        if (!file_exists($path)) {
            return redirect()->back()->with('error', 'File not found.');
        }

        return response()->download($path, $drawing->file_name);
    }

    public function show(QaStageDrawing $drawing)
    {
        $drawing->load([
            'qaStage.location',
            'drawingSheet.revisions' => function ($query) {
                $query->select('id', 'drawing_sheet_id', 'name', 'revision_number', 'revision_date', 'status', 'created_at', 'thumbnail_path', 'file_path', 'diff_image_path')
                    ->orderBy('created_at', 'desc');
            },
            'previousRevision:id,name,revision_number,file_path,thumbnail_path',
            'createdBy',
            'observations.createdBy',
        ]);

        return Inertia::render('qa-stages/drawings/show', [
            'drawing' => $drawing,
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
