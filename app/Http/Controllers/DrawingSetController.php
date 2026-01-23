<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessDrawingSetJob;
use App\Models\DrawingSet;
use App\Models\DrawingSheet;
use App\Models\Location;
use App\Models\QaStageDrawing;
use App\Models\TitleBlockTemplate;
use App\Services\DrawingComparisonService;
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
            ->with([
                'createdBy:id,name',
                'firstSheet:id,drawing_set_id,thumbnail_s3_key',
            ])
            ->withCount([
                'sheets',
                'sheetsNeedingReview',
                'successfulSheets',
            ])
            ->orderByDesc('created_at')
            ->paginate(20);

        // Add thumbnail URL for each drawing set
        $drawingSets->getCollection()->transform(function ($drawingSet) {
            if ($drawingSet->firstSheet && $drawingSet->firstSheet->thumbnail_s3_key) {
                $drawingSet->thumbnail_url = "/drawing-sheets/{$drawingSet->firstSheet->id}/thumbnail";
            } else {
                $drawingSet->thumbnail_url = null;
            }
            return $drawingSet;
        });

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

            // Load relationships and counts for the response
            $drawingSet->load('createdBy:id,name');
            $drawingSet->loadCount([
                'sheets',
                'sheetsNeedingReview',
                'successfulSheets',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Drawing set uploaded successfully. Processing has started.',
                'drawing_set' => $drawingSet,
            ]);

        } catch (\Exception $e) {
            \Log::error('Failed to upload drawing set', [
                'project_id' => $project->id,
                'original_name' => $file->getClientOriginalName(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

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
     * Optionally accepts a template_id to force use of a specific template.
     */
    public function retryExtraction(Request $request, QaStageDrawing $sheet): JsonResponse
    {
        if (!$sheet->drawing_set_id) {
            return response()->json([
                'success' => false,
                'message' => 'Sheet is not part of a drawing set.',
            ], 422);
        }

        $templateId = $request->input('template_id') ? (int) $request->input('template_id') : null;

        \Log::info('Retry extraction requested', [
            'sheet_id' => $sheet->id,
            'template_id' => $templateId,
            'request_all' => $request->all(),
        ]);

        // Clear all cached extraction data to force fresh template selection
        $sheet->update([
            'extraction_status' => QaStageDrawing::EXTRACTION_QUEUED,
            'extraction_errors' => null,
            'used_template_id' => null,
            'extraction_raw' => null,
            'drawing_number' => null,
            'drawing_title' => null,
            'revision' => null,
            'confidence_number' => null,
            'confidence_title' => null,
            'confidence_revision' => null,
            'extracted_at' => null,
        ]);

        // Dispatch extraction job for this sheet with optional preferred template
        $job = new \App\Jobs\ExtractSheetMetadataJob($sheet->id, $templateId);

        \Log::info('Dispatching extraction job', [
            'sheet_id' => $sheet->id,
            'template_id' => $templateId,
            'job_preferred_template_id' => $job->preferredTemplateId,
        ]);

        // Run synchronously if sync=1 param is passed (for debugging)
        if ($request->boolean('sync')) {
            \Log::info('Running job synchronously for debugging');
            dispatch_sync($job);
        } else {
            dispatch($job);
        }

        $message = $templateId
            ? 'Extraction retry queued with selected template.'
            : 'Extraction retry queued.';

        return response()->json([
            'success' => true,
            'message' => $message,
        ]);
    }

    /**
     * Retry extraction for all failed/needs_review sheets in a set.
     * If force=true, also retry successful sheets.
     */
    public function retryAllExtraction(Request $request, DrawingSet $drawingSet): JsonResponse
    {
        $force = $request->boolean('force', false);

        $query = $drawingSet->sheets();

        if ($force) {
            // Force retry: include all sheets including successful ones
            $sheets = $query->get();
        } else {
            // Normal retry: only failed/needs_review sheets
            $sheets = $query->whereIn('extraction_status', [
                QaStageDrawing::EXTRACTION_NEEDS_REVIEW,
                QaStageDrawing::EXTRACTION_FAILED,
            ])->get();
        }

        foreach ($sheets as $sheet) {
            // Clear all cached extraction data to force fresh template selection
            $sheet->update([
                'extraction_status' => QaStageDrawing::EXTRACTION_QUEUED,
                'extraction_errors' => null,
                'used_template_id' => null,
                'extraction_raw' => null,
                'drawing_number' => null,
                'drawing_title' => null,
                'revision' => null,
                'confidence_number' => null,
                'confidence_title' => null,
                'confidence_revision' => null,
                'extracted_at' => null,
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
     * Re-link sheets that have a drawing_number but no drawing_sheet_id.
     * This fixes sheets that weren't linked due to errors during initial extraction.
     */
    public function relinkSheets(DrawingSet $drawingSet): JsonResponse
    {
        $projectId = $drawingSet->project_id;

        // Find all sheets with drawing_number but no drawing_sheet_id
        $unlinkedSheets = $drawingSet->sheets()
            ->whereNotNull('drawing_number')
            ->where('drawing_number', '!=', '')
            ->whereNull('drawing_sheet_id')
            ->get();

        if ($unlinkedSheets->isEmpty()) {
            return response()->json([
                'success' => true,
                'message' => 'All sheets are already linked.',
                'linked_count' => 0,
            ]);
        }

        $linkedCount = 0;
        $errors = [];

        foreach ($unlinkedSheets as $sheet) {
            try {
                // Find or create DrawingSheet for this drawing number
                $drawingSheet = \App\Models\DrawingSheet::findOrCreateByDrawingNumber(
                    $projectId,
                    $sheet->drawing_number,
                    $sheet->drawing_title,
                    null, // discipline
                    $sheet->created_by
                );

                // Link the sheet
                $drawingSheet->addRevision($sheet, $sheet->revision);
                $linkedCount++;

                \Log::info('Re-linked sheet to DrawingSheet', [
                    'sheet_id' => $sheet->id,
                    'drawing_sheet_id' => $drawingSheet->id,
                    'drawing_number' => $sheet->drawing_number,
                    'revision' => $sheet->revision,
                ]);
            } catch (\Exception $e) {
                $errors[] = "Sheet {$sheet->id}: {$e->getMessage()}";
                \Log::warning('Failed to re-link sheet', [
                    'sheet_id' => $sheet->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $message = "Linked {$linkedCount} of {$unlinkedSheets->count()} sheets.";
        if (!empty($errors)) {
            $message .= " Errors: " . implode('; ', array_slice($errors, 0, 3));
        }

        return response()->json([
            'success' => true,
            'message' => $message,
            'linked_count' => $linkedCount,
            'total_unlinked' => $unlinkedSheets->count(),
            'errors' => $errors,
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

    /**
     * Serve a drawing sheet thumbnail image from S3 (small JPEG for list views).
     */
    public function sheetThumbnail(QaStageDrawing $sheet)
    {
        if (!$sheet->thumbnail_s3_key) {
            // Fall back to full preview if no thumbnail
            if ($sheet->page_preview_s3_key) {
                $url = Storage::disk('s3')->temporaryUrl(
                    $sheet->page_preview_s3_key,
                    now()->addMinutes(5)
                );
                return redirect($url);
            }
            abort(404, 'No thumbnail available');
        }

        // Generate a temporary URL (valid for 5 minutes)
        $url = Storage::disk('s3')->temporaryUrl(
            $sheet->thumbnail_s3_key,
            now()->addMinutes(5)
        );

        return redirect($url);
    }

    /**
     * Serve the original PDF from a drawing set.
     * Streams the PDF content directly to avoid CORS issues with S3.
     */
    public function servePdf(DrawingSet $drawingSet)
    {
        if (!$drawingSet->original_pdf_s3_key) {
            abort(404, 'No PDF available');
        }

        // Stream the PDF directly from S3 to avoid CORS issues
        $stream = Storage::disk('s3')->readStream($drawingSet->original_pdf_s3_key);

        if (!$stream) {
            abort(404, 'Could not read PDF from storage');
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
                'Content-Disposition' => 'inline; filename="' . $filename . '"',
                'Cache-Control' => 'private, max-age=3600',
            ]
        );
    }

    /**
     * Compare two drawing revisions using AI to identify changes.
     * Accepts two QaStageDrawing IDs and returns a summary of differences.
     */
    public function compareRevisions(Request $request): JsonResponse
    {
        // Allow longer execution time and more memory for AI analysis
        set_time_limit(180);
        ini_set('memory_limit', '1G');

        $validated = $request->validate([
            'sheet_a_id' => ['required', 'integer', 'exists:qa_stage_drawings,id'],
            'sheet_b_id' => ['required', 'integer', 'exists:qa_stage_drawings,id'],
            'context' => ['nullable', 'string', 'max:200'],
            'additional_prompt' => ['nullable', 'string', 'max:1000'], // For regeneration with refinement
        ]);

        $sheetA = QaStageDrawing::findOrFail($validated['sheet_a_id']);
        $sheetB = QaStageDrawing::findOrFail($validated['sheet_b_id']);

        // Helper to get image path (prefers page_preview_s3_key, falls back to thumbnail_path)
        $getImagePath = function ($sheet) {
            return $sheet->page_preview_s3_key ?: $sheet->thumbnail_path;
        };

        $imagePathA = $getImagePath($sheetA);
        $imagePathB = $getImagePath($sheetB);

        // Verify both sheets have preview images
        if (!$imagePathA || !$imagePathB) {
            return response()->json([
                'success' => false,
                'message' => 'Both sheets must have preview images to compare. Missing: ' .
                    (!$imagePathA ? 'Sheet A' : '') .
                    (!$imagePathA && !$imagePathB ? ' and ' : '') .
                    (!$imagePathB ? 'Sheet B' : ''),
            ], 422);
        }

        $comparisonService = app(DrawingComparisonService::class);

        // Get images as base64 data URLs
        $imageA = $comparisonService->getImageDataUrl($imagePathA);
        $imageB = $comparisonService->getImageDataUrl($imagePathB);

        if (!$imageA || !$imageB) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to load sheet images from storage.',
            ], 500);
        }

        \Log::info('Starting AI drawing comparison', [
            'sheet_a_id' => $sheetA->id,
            'sheet_b_id' => $sheetB->id,
            'sheet_a_revision' => $sheetA->revision,
            'sheet_b_revision' => $sheetB->revision,
            'sheet_a_drawing_number' => $sheetA->drawing_number,
        ]);

        // Run comparison
        $context = $validated['context'] ?? 'walls and ceilings construction drawings';
        $additionalPrompt = $validated['additional_prompt'] ?? null;
        $result = $comparisonService->compareRevisions($imageA, $imageB, $context, $additionalPrompt);

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'message' => 'AI comparison failed: ' . ($result['error'] ?? 'Unknown error'),
            ], 500);
        }

        return response()->json([
            'success' => true,
            'comparison' => [
                'sheet_a' => [
                    'id' => $sheetA->id,
                    'drawing_number' => $sheetA->drawing_number,
                    'revision' => $sheetA->revision,
                ],
                'sheet_b' => [
                    'id' => $sheetB->id,
                    'drawing_number' => $sheetB->drawing_number,
                    'revision' => $sheetB->revision,
                ],
                'summary' => $result['summary'],
                'changes' => $result['changes'],
                'change_count' => $result['change_count'] ?? count($result['changes'] ?? []),
                'confidence' => $result['confidence'] ?? 'unknown',
                'notes' => $result['notes'] ?? null,
            ],
        ]);
    }

    /**
     * Get all revisions of a drawing sheet for comparison.
     */
    public function getDrawingSheetRevisions(DrawingSheet $drawingSheet): JsonResponse
    {
        $revisions = $drawingSheet->revisions()
            ->whereNotNull('page_preview_s3_key')
            ->orderBy('created_at', 'asc')
            ->get(['id', 'revision_number', 'revision', 'drawing_number', 'drawing_title', 'created_at']);

        return response()->json([
            'success' => true,
            'drawing_sheet' => [
                'id' => $drawingSheet->id,
                'sheet_number' => $drawingSheet->sheet_number,
                'title' => $drawingSheet->title,
            ],
            'revisions' => $revisions,
        ]);
    }

    /**
     * Save AI-detected changes as observations.
     * Creates observation records for selected AI comparison changes.
     */
    public function saveComparisonAsObservations(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'sheet_a_id' => ['required', 'integer', 'exists:qa_stage_drawings,id'],
            'sheet_b_id' => ['required', 'integer', 'exists:qa_stage_drawings,id'],
            'target_sheet_id' => ['required', 'integer', 'exists:qa_stage_drawings,id'],
            'changes' => ['required', 'array', 'min:1'],
            'changes.*.type' => ['required', 'string'],
            'changes.*.description' => ['required', 'string', 'max:2000'],
            'changes.*.location' => ['required', 'string'],
            'changes.*.impact' => ['required', 'string', 'in:low,medium,high'],
            'changes.*.potential_change_order' => ['required', 'boolean'],
            'changes.*.reason' => ['nullable', 'string'],
        ]);

        $targetSheet = QaStageDrawing::findOrFail($validated['target_sheet_id']);
        $createdObservations = [];

        try {
            \DB::beginTransaction();

            foreach ($validated['changes'] as $index => $change) {
                // Create observation from AI change
                // AI doesn't provide exact coordinates, so we place markers in a grid pattern
                // User can adjust positions later when reviewing
                $gridX = 0.1 + (($index % 4) * 0.2); // 0.1, 0.3, 0.5, 0.7
                $gridY = 0.1 + (floor($index / 4) * 0.15); // Stack vertically

                $observation = \App\Models\QaStageDrawingObservation::create([
                    'qa_stage_drawing_id' => $targetSheet->id,
                    'page_number' => $targetSheet->page_number ?? 1,
                    'x' => min($gridX, 0.9),
                    'y' => min($gridY, 0.9),
                    'type' => 'observation',
                    'description' => "[{$change['type']}] {$change['description']}\n\nLocation: {$change['location']}" .
                        ($change['reason'] ? "\n\nReason: {$change['reason']}" : ''),
                    'source' => 'ai_comparison',
                    'source_sheet_a_id' => $validated['sheet_a_id'],
                    'source_sheet_b_id' => $validated['sheet_b_id'],
                    'ai_change_type' => $change['type'],
                    'ai_impact' => $change['impact'],
                    'ai_location' => $change['location'],
                    'potential_change_order' => $change['potential_change_order'],
                    'is_confirmed' => false,
                ]);

                $createdObservations[] = $observation;
            }

            \DB::commit();

            \Log::info('AI comparison observations saved', [
                'target_sheet_id' => $targetSheet->id,
                'count' => count($createdObservations),
            ]);

            return response()->json([
                'success' => true,
                'message' => count($createdObservations) . ' observations created from AI comparison',
                'observations' => $createdObservations,
            ]);
        } catch (\Exception $e) {
            \DB::rollBack();
            \Log::error('Failed to save AI comparison observations', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to save observations: ' . $e->getMessage(),
            ], 500);
        }
    }
}
