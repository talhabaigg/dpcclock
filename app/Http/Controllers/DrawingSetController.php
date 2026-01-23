<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessDrawingSetJob;
use App\Models\DrawingSet;
use App\Models\Location;
use App\Models\QaStageDrawing;
use App\Models\TitleBlockTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class DrawingSetController extends Controller
{
    /**
     * Display a listing of drawing sets for a project.
     */
    public function index(Request $request, Location $project): Response
    {
        $drawingSets = DrawingSet::where('project_id', $project->id)
            ->with(['createdBy:id,name'])
            ->withCount([
                'sheets',
                'sheetsNeedingReview',
                'successfulSheets',
            ])
            ->orderByDesc('created_at')
            ->paginate(20);

        return Inertia::render('drawing-sets/index', [
            'project' => $project,
            'drawingSets' => $drawingSets,
        ]);
    }

    /**
     * Display a specific drawing set with its sheets.
     */
    public function show(DrawingSet $drawingSet): Response
    {
        $drawingSet->load([
            'project:id,name',
            'createdBy:id,name',
            'sheets' => function ($query) {
                $query->orderBy('page_number')
                    ->select([
                        'id', 'drawing_set_id', 'page_number',
                        'page_preview_s3_key', 'thumbnail_path',
                        'drawing_number', 'drawing_title', 'revision',
                        'extraction_status', 'confidence_number',
                        'confidence_title', 'confidence_revision',
                        'extraction_errors', 'extraction_raw', 'used_template_id',
                    ]);
            },
        ]);

        $templates = TitleBlockTemplate::where('project_id', $drawingSet->project_id)
            ->orderBy('success_count', 'desc')
            ->get();

        return Inertia::render('drawing-sets/show', [
            'drawingSet' => $drawingSet,
            'templates' => $templates,
            'stats' => $drawingSet->extraction_stats,
        ]);
    }

    /**
     * Upload a new drawing set (multi-page PDF).
     */
    public function store(Request $request, Location $project): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:pdf', 'max:102400'], // 100MB max
        ]);

        $file = $request->file('file');

        // Check for duplicate by SHA256
        $sha256 = hash_file('sha256', $file->getRealPath());
        $existing = DrawingSet::where('project_id', $project->id)
            ->where('sha256', $sha256)
            ->first();

        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'This PDF has already been uploaded.',
                'existing_id' => $existing->id,
            ], 422);
        }

        try {
            $drawingSet = DB::transaction(function () use ($project, $file, $sha256) {
                // Read file content first
                $filePath = $file->getRealPath();
                $fileContent = file_get_contents($filePath);

                if (empty($fileContent)) {
                    throw new \RuntimeException('Failed to read uploaded file content');
                }

                // Validate PDF header
                if (!str_starts_with($fileContent, '%PDF-')) {
                    throw new \RuntimeException('Invalid PDF file - does not have PDF header');
                }

                \Log::info('Uploading PDF to S3', [
                    'project_id' => $project->id,
                    'file_size' => strlen($fileContent),
                    'original_name' => $file->getClientOriginalName(),
                ]);

                // Store PDF in S3
                $s3Key = 'drawing-sets/' . $project->id . '/' . time() . '_' . $file->hashName();
                $uploaded = Storage::disk('s3')->put($s3Key, $fileContent, [
                    'ContentType' => 'application/pdf',
                ]);

                if (!$uploaded) {
                    throw new \RuntimeException('Failed to upload PDF to S3');
                }

                // Verify upload by checking file exists in S3
                if (!Storage::disk('s3')->exists($s3Key)) {
                    throw new \RuntimeException('PDF uploaded but not found in S3');
                }

                $s3Size = Storage::disk('s3')->size($s3Key);
                \Log::info('PDF uploaded to S3', [
                    's3_key' => $s3Key,
                    's3_size' => $s3Size,
                    'original_size' => strlen($fileContent),
                ]);

                if ($s3Size === 0) {
                    Storage::disk('s3')->delete($s3Key);
                    throw new \RuntimeException('PDF uploaded to S3 but file is empty');
                }

                // Get page count from PDF
                $pageCount = $this->getPdfPageCount($filePath);

                // Create drawing set record
                $drawingSet = DrawingSet::create([
                    'project_id' => $project->id,
                    'original_pdf_s3_key' => $s3Key,
                    'page_count' => $pageCount,
                    'status' => DrawingSet::STATUS_QUEUED,
                    'original_filename' => $file->getClientOriginalName(),
                    'file_size' => $file->getSize(),
                    'sha256' => $sha256,
                ]);

                // Create sheet records for each page
                for ($page = 1; $page <= $pageCount; $page++) {
                    QaStageDrawing::create([
                        'qa_stage_id' => null, // Will be set if linked to a QA stage
                        'drawing_set_id' => $drawingSet->id,
                        'page_number' => $page,
                        'extraction_status' => QaStageDrawing::EXTRACTION_QUEUED,
                        'created_by' => auth()->id(),
                    ]);
                }

                return $drawingSet;
            });

            // Dispatch processing job
            ProcessDrawingSetJob::dispatch($drawingSet->id);

            return response()->json([
                'success' => true,
                'message' => 'Drawing set uploaded successfully. Processing has started.',
                'drawing_set' => $drawingSet,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to upload drawing set: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get the page count of a PDF file.
     */
    private function getPdfPageCount(string $pdfPath): int
    {
        // Find pdfinfo executable
        $pdfinfo = $this->findPdfinfo();

        if ($pdfinfo) {
            $output = [];
            $returnCode = 0;
            $command = escapeshellarg($pdfinfo) . ' ' . escapeshellarg($pdfPath) . ' 2>&1';
            exec($command, $output, $returnCode);

            if ($returnCode === 0) {
                foreach ($output as $line) {
                    if (preg_match('/^Pages:\s*(\d+)/i', $line, $matches)) {
                        return (int) $matches[1];
                    }
                }
            }
        }

        // Fallback: try Imagick
        if (extension_loaded('imagick')) {
            try {
                $imagick = new \Imagick();
                $imagick->pingImage($pdfPath);
                return $imagick->getNumberImages();
            } catch (\Exception $e) {
                // Fall through to default
            }
        }

        // Default to 1 if we can't determine
        return 1;
    }

    private function findPdfinfo(): ?string
    {
        // Check common Windows installation paths
        $windowsPaths = [
            'C:\\poppler\\poppler-24.08.0\\Library\\bin\\pdfinfo.exe',
            'C:\\poppler\\Library\\bin\\pdfinfo.exe',
            'C:\\Program Files\\poppler\\Library\\bin\\pdfinfo.exe',
        ];

        foreach ($windowsPaths as $path) {
            if (file_exists($path)) {
                return $path;
            }
        }

        // Check if in PATH
        $checkCommand = PHP_OS_FAMILY === 'Windows' ? 'where pdfinfo 2>nul' : 'which pdfinfo 2>/dev/null';
        $output = [];
        exec($checkCommand, $output, $returnCode);

        if ($returnCode === 0 && !empty($output[0])) {
            return trim($output[0]);
        }

        return null;
    }

    /**
     * Update a sheet's extracted metadata (user correction).
     */
    public function updateSheet(Request $request, QaStageDrawing $sheet): JsonResponse
    {
        $validated = $request->validate([
            'drawing_number' => ['nullable', 'string', 'max:100'],
            'drawing_title' => ['nullable', 'string', 'max:500'],
            'revision' => ['nullable', 'string', 'max:50'],
        ]);

        $sheet->update([
            'drawing_number' => $validated['drawing_number'],
            'drawing_title' => $validated['drawing_title'],
            'revision' => $validated['revision'],
            'extraction_status' => QaStageDrawing::EXTRACTION_SUCCESS,
            'extraction_errors' => null, // Clear errors after manual correction
        ]);

        // Update parent drawing set status
        if ($sheet->drawingSet) {
            $sheet->drawingSet->updateStatusFromSheets();
        }

        return response()->json([
            'success' => true,
            'message' => 'Sheet metadata updated successfully.',
            'sheet' => $sheet->fresh(),
        ]);
    }

    /**
     * Retry extraction for a specific sheet.
     */
    public function retryExtraction(QaStageDrawing $sheet): JsonResponse
    {
        if (!$sheet->drawing_set_id) {
            return response()->json([
                'success' => false,
                'message' => 'Sheet is not part of a drawing set.',
            ], 422);
        }

        $sheet->update([
            'extraction_status' => QaStageDrawing::EXTRACTION_QUEUED,
            'extraction_errors' => null,
        ]);

        // Dispatch extraction job for this sheet
        \App\Jobs\ExtractSheetMetadataJob::dispatch($sheet->id);

        return response()->json([
            'success' => true,
            'message' => 'Extraction retry queued.',
        ]);
    }

    /**
     * Retry extraction for all failed/needs_review sheets in a set.
     */
    public function retryAllExtraction(DrawingSet $drawingSet): JsonResponse
    {
        $sheets = $drawingSet->sheets()
            ->whereIn('extraction_status', [
                QaStageDrawing::EXTRACTION_NEEDS_REVIEW,
                QaStageDrawing::EXTRACTION_FAILED,
            ])
            ->get();

        foreach ($sheets as $sheet) {
            $sheet->update([
                'extraction_status' => QaStageDrawing::EXTRACTION_QUEUED,
                'extraction_errors' => null,
            ]);

            \App\Jobs\ExtractSheetMetadataJob::dispatch($sheet->id);
        }

        $drawingSet->update(['status' => DrawingSet::STATUS_PROCESSING]);

        return response()->json([
            'success' => true,
            'message' => "Queued {$sheets->count()} sheets for re-extraction.",
        ]);
    }

    /**
     * Delete a drawing set and all associated sheets.
     */
    public function destroy(DrawingSet $drawingSet): JsonResponse
    {
        try {
            DB::transaction(function () use ($drawingSet) {
                // Delete S3 files
                if ($drawingSet->original_pdf_s3_key) {
                    Storage::disk('s3')->delete($drawingSet->original_pdf_s3_key);
                }

                // Delete page preview images
                foreach ($drawingSet->sheets as $sheet) {
                    if ($sheet->page_preview_s3_key) {
                        Storage::disk('s3')->delete($sheet->page_preview_s3_key);
                    }
                }

                // Delete sheets (will cascade from model events if needed)
                $drawingSet->sheets()->delete();

                // Delete the set
                $drawingSet->delete();
            });

            return response()->json([
                'success' => true,
                'message' => 'Drawing set deleted successfully.',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete drawing set: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Serve a drawing sheet preview image from S3.
     */
    public function sheetPreview(QaStageDrawing $sheet)
    {
        if (!$sheet->page_preview_s3_key) {
            abort(404, 'No preview available');
        }

        // Generate a temporary URL (valid for 5 minutes)
        $url = Storage::disk('s3')->temporaryUrl(
            $sheet->page_preview_s3_key,
            now()->addMinutes(5)
        );

        return redirect($url);
    }
}
