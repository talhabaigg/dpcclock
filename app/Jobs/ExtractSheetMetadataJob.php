<?php

namespace App\Jobs;

use App\Models\DrawingSheet;
use App\Models\QaStageDrawing;
use App\Models\TitleBlockTemplate;
use App\Services\DrawingMetadataValidationService;
use App\Services\ImageCropService;
use App\Services\TextractService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Job to extract metadata from a single drawing sheet using AWS Textract.
 *
 * Extraction strategy (tiered attempts):
 * 1. Try matching TitleBlockTemplates for the project
 * 2. Try heuristic crop (bottom-right region)
 * 3. Try full page image (last resort)
 */
class ExtractSheetMetadataJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 60;
    public int $timeout = 300; // 5 minutes

    public function __construct(
        public int $sheetId
    ) {}

    public function handle(
        TextractService $textract,
        ImageCropService $cropService,
        DrawingMetadataValidationService $validator
    ): void {
        // Increase memory limit for large images (300 DPI drawings can be 200MB+ uncompressed)
        ini_set('memory_limit', '1G');

        $sheet = QaStageDrawing::with('drawingSet')->find($this->sheetId);

        if (!$sheet) {
            Log::error('Sheet not found for extraction', ['id' => $this->sheetId]);
            return;
        }

        if (!$sheet->page_preview_s3_key) {
            Log::error('Sheet has no preview image', ['id' => $this->sheetId]);
            $sheet->update([
                'extraction_status' => QaStageDrawing::EXTRACTION_FAILED,
                'extraction_errors' => ['error' => 'No preview image available'],
            ]);
            return;
        }

        $sheet->update(['extraction_status' => QaStageDrawing::EXTRACTION_PROCESSING]);

        $projectId = $sheet->drawingSet?->project_id;
        $bestResult = null;
        $allAttempts = [];

        // Check if image is too large for in-memory cropping
        // GD requires ~4 bytes per pixel for RGBA. Skip heuristic cropping for huge images.
        // But still allow template-based cropping as templates target small regions.
        $imageSizeBytes = ($sheet->page_width_px ?? 0) * ($sheet->page_height_px ?? 0) * 4;
        $skipHeuristicCropping = $imageSizeBytes > 200 * 1024 * 1024; // Skip if > 200MB uncompressed

        if ($skipHeuristicCropping) {
            Log::info('Large image detected - will skip heuristic cropping but templates are still allowed', [
                'sheet_id' => $sheet->id,
                'width' => $sheet->page_width_px,
                'height' => $sheet->page_height_px,
                'estimated_memory' => number_format($imageSizeBytes / 1024 / 1024, 1) . ' MB',
            ]);
        }

        try {
            // Attempt 1: Try matching templates (always allowed - templates target small regions)
            if ($projectId) {
                $templates = TitleBlockTemplate::findBestMatches(
                    $projectId,
                    $sheet->page_orientation,
                    $sheet->size_bucket,
                    2 // Try top 2 templates
                );

                foreach ($templates as $template) {
                    $result = $this->extractWithTemplate(
                        $sheet, $template, $textract, $cropService, $validator
                    );
                    $result['used_template_id'] = $template->id;
                    $allAttempts[] = [
                        'method' => 'template',
                        'template_id' => $template->id,
                        'result' => $result,
                    ];

                    // Always compare template results - they may be better even if validation fails
                    $bestResult = $this->compareBestResult($bestResult, $result);

                    if ($result['passes']) {
                        // If this result passes and has good confidence, use it and stop
                        if ($result['overall_confidence'] >= 0.7) {
                            $template->recordSuccess();
                            break;
                        }
                    }
                }
            }

            // Attempt 2: Try heuristic crop if no template succeeded (skip for large images)
            if ((!$bestResult || !$bestResult['passes']) && !$skipHeuristicCropping) {
                $result = $this->extractWithHeuristic(
                    $sheet, $textract, $cropService, $validator
                );
                $allAttempts[] = [
                    'method' => 'heuristic',
                    'result' => $result,
                ];

                if ($result['passes']) {
                    $bestResult = $this->compareBestResult($bestResult, $result);
                }
            }

            // Attempt 3: Try full page if still no success
            if (!$bestResult || !$bestResult['passes']) {
                $result = $this->extractFullPage(
                    $sheet, $textract, $validator
                );
                $result['full_page_fallback'] = true;
                if ($skipHeuristicCropping) {
                    $result['skipped_heuristic_cropping'] = true;
                }
                $allAttempts[] = [
                    'method' => 'full_page',
                    'result' => $result,
                ];

                $bestResult = $this->compareBestResult($bestResult, $result);

                // Preserve flags on best result if this was the result chosen
                if ($bestResult === $result || ($bestResult && !isset($bestResult['skipped_heuristic_cropping']))) {
                    $bestResult['skipped_heuristic_cropping'] = $skipHeuristicCropping;
                }
            }

            // Save results
            $this->saveExtractionResult($sheet, $bestResult, $allAttempts, $skipHeuristicCropping);

        } catch (\Exception $e) {
            Log::error('Extraction failed for sheet', [
                'sheet_id' => $sheet->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $sheet->update([
                'extraction_status' => QaStageDrawing::EXTRACTION_FAILED,
                'extraction_errors' => [
                    'error' => $e->getMessage(),
                    'attempts' => $allAttempts,
                ],
            ]);
        }
    }

    /**
     * Extract using a specific template's crop region.
     */
    private function extractWithTemplate(
        QaStageDrawing $sheet,
        TitleBlockTemplate $template,
        TextractService $textract,
        ImageCropService $cropService,
        DrawingMetadataValidationService $validator
    ): array {
        // Crop image using template
        $croppedBytes = $cropService->cropImage(
            $sheet->page_preview_s3_key,
            $template->crop_rect,
            's3'
        );

        if (!$croppedBytes) {
            return [
                'passes' => false,
                'error' => 'Failed to crop image with template',
                'overall_confidence' => 0,
            ];
        }

        // Extract with Textract
        $textractResult = $textract->extractFromBytes($croppedBytes);

        if (!$textractResult['success']) {
            return [
                'passes' => false,
                'error' => $textractResult['error'] ?? 'Textract extraction failed',
                'overall_confidence' => 0,
            ];
        }

        // Validate results
        $validation = $validator->validate($textractResult['fields']);

        return [
            'passes' => $validation['passes'],
            'fields' => $textractResult['fields'],
            'validation' => $validation,
            'raw' => $textractResult['raw'],
            'overall_confidence' => $validator->calculateOverallConfidence($validation),
        ];
    }

    /**
     * Extract using heuristic bottom-right crop.
     */
    private function extractWithHeuristic(
        QaStageDrawing $sheet,
        TextractService $textract,
        ImageCropService $cropService,
        DrawingMetadataValidationService $validator
    ): array {
        // Crop using default heuristic region
        $croppedBytes = $cropService->cropHeuristic(
            $sheet->page_preview_s3_key,
            's3'
        );

        if (!$croppedBytes) {
            return [
                'passes' => false,
                'error' => 'Failed to crop image with heuristic',
                'overall_confidence' => 0,
            ];
        }

        // Extract with Textract
        $textractResult = $textract->extractFromBytes($croppedBytes);

        if (!$textractResult['success']) {
            return [
                'passes' => false,
                'error' => $textractResult['error'] ?? 'Textract extraction failed',
                'overall_confidence' => 0,
            ];
        }

        // Validate results
        $validation = $validator->validate($textractResult['fields']);

        return [
            'passes' => $validation['passes'],
            'fields' => $textractResult['fields'],
            'validation' => $validation,
            'raw' => $textractResult['raw'],
            'overall_confidence' => $validator->calculateOverallConfidence($validation),
        ];
    }

    /**
     * Extract from full page image (last resort).
     */
    private function extractFullPage(
        QaStageDrawing $sheet,
        TextractService $textract,
        DrawingMetadataValidationService $validator
    ): array {
        // Extract directly from S3
        $textractResult = $textract->extractFromS3($sheet->page_preview_s3_key);

        if (!$textractResult['success']) {
            return [
                'passes' => false,
                'error' => $textractResult['error'] ?? 'Textract extraction failed',
                'overall_confidence' => 0,
            ];
        }

        // Validate results
        $validation = $validator->validate($textractResult['fields']);

        return [
            'passes' => $validation['passes'],
            'fields' => $textractResult['fields'],
            'validation' => $validation,
            'raw' => $textractResult['raw'],
            'overall_confidence' => $validator->calculateOverallConfidence($validation),
        ];
    }

    /**
     * Compare two results and return the better one.
     */
    private function compareBestResult(?array $current, array $new): array
    {
        if ($current === null) {
            return $new;
        }

        // Prefer passing results
        if ($new['passes'] && !$current['passes']) {
            return $new;
        }

        if (!$new['passes'] && $current['passes']) {
            return $current;
        }

        // If both pass or both fail, prefer higher confidence
        if (($new['overall_confidence'] ?? 0) > ($current['overall_confidence'] ?? 0)) {
            return $new;
        }

        return $current;
    }

    /**
     * Save extraction results to the sheet.
     */
    private function saveExtractionResult(
        QaStageDrawing $sheet,
        ?array $result,
        array $allAttempts,
        bool $skippedHeuristicCropping = false
    ): void {
        if ($result === null || !isset($result['fields'])) {
            $sheet->update([
                'extraction_status' => QaStageDrawing::EXTRACTION_FAILED,
                'extraction_errors' => [
                    'error' => 'No extraction result available',
                    'attempts' => $allAttempts,
                ],
            ]);
            return;
        }

        $validation = $result['validation'] ?? [];

        $updateData = [
            'drawing_number' => $validation['drawing_number']['value'] ?? null,
            'drawing_title' => $validation['drawing_title']['value'] ?? null,
            'revision' => $validation['revision']['value'] ?? null,
            'confidence_number' => $validation['drawing_number']['confidence'] ?? null,
            'confidence_title' => $validation['drawing_title']['confidence'] ?? null,
            'confidence_revision' => $validation['revision']['confidence'] ?? null,
            'used_template_id' => $result['used_template_id'] ?? null,
            'extraction_raw' => [
                'fields' => $result['fields'],
                'raw_queries' => $result['raw'] ?? [],
            ],
            'extracted_at' => now(),
        ];

        if ($result['passes']) {
            $updateData['extraction_status'] = QaStageDrawing::EXTRACTION_SUCCESS;
            $updateData['extraction_errors'] = null;
        } else {
            $updateData['extraction_status'] = QaStageDrawing::EXTRACTION_NEEDS_REVIEW;
            $errors = [
                'validation_errors' => $validation['overall_errors'] ?? [],
                'field_errors' => [
                    'drawing_number' => $validation['drawing_number']['errors'] ?? [],
                    'drawing_title' => $validation['drawing_title']['errors'] ?? [],
                    'revision' => $validation['revision']['errors'] ?? [],
                ],
                'best_guesses' => [
                    'drawing_number' => $result['fields']['drawing_number']['text'] ?? null,
                    'drawing_title' => $result['fields']['drawing_title']['text'] ?? null,
                    'revision' => $result['fields']['revision']['text'] ?? null,
                ],
            ];

            // Add note if heuristic cropping was skipped due to large image and no template was used
            if ($skippedHeuristicCropping && empty($result['used_template_id'])) {
                $errors['note'] = 'Image too large for auto-cropping - full page analysis used. Results may be less accurate. Create a template by clicking "Draw Template" for better extraction.';
            }

            $updateData['extraction_errors'] = $errors;
        }

        $sheet->update($updateData);

        // Link to DrawingSheet for revision comparison when we have a valid drawing number
        $this->linkToDrawingSheet($sheet, $updateData['drawing_number'], $updateData['drawing_title']);

        // Update drawing set status if applicable
        if ($sheet->drawingSet) {
            $sheet->drawingSet->updateStatusFromSheets();
        }
    }

    /**
     * Link the sheet to a DrawingSheet for revision grouping and comparison.
     * This enables sheets with the same drawing number to be compared across revisions.
     */
    private function linkToDrawingSheet(QaStageDrawing $sheet, ?string $drawingNumber, ?string $title): void
    {
        // Skip if no drawing number extracted
        if (empty($drawingNumber)) {
            return;
        }

        // Skip if already linked
        if ($sheet->drawing_sheet_id) {
            return;
        }

        // Get project ID from drawing set
        $projectId = $sheet->drawingSet?->project_id;
        if (!$projectId) {
            return;
        }

        try {
            // Find or create a DrawingSheet for this drawing number
            $drawingSheet = DrawingSheet::findOrCreateByDrawingNumber(
                $projectId,
                $drawingNumber,
                $title
            );

            // Add this sheet as a revision
            // Use the extracted revision as the revision_number
            $revisionNumber = $sheet->revision;

            // Link the sheet to the DrawingSheet
            $drawingSheet->addRevision($sheet, $revisionNumber);

            Log::info('Linked sheet to DrawingSheet', [
                'sheet_id' => $sheet->id,
                'drawing_sheet_id' => $drawingSheet->id,
                'drawing_number' => $drawingNumber,
                'revision' => $revisionNumber,
            ]);
        } catch (\Exception $e) {
            Log::warning('Failed to link sheet to DrawingSheet', [
                'sheet_id' => $sheet->id,
                'drawing_number' => $drawingNumber,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Parse memory limit string to bytes.
     */
    private function parseMemoryLimit(string $limit): int
    {
        $limit = trim($limit);
        if ($limit === '-1') {
            return PHP_INT_MAX;
        }

        $unit = strtolower(substr($limit, -1));
        $value = (int) $limit;

        return match ($unit) {
            'g' => $value * 1024 * 1024 * 1024,
            'm' => $value * 1024 * 1024,
            'k' => $value * 1024,
            default => $value,
        };
    }

    /**
     * Handle job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('ExtractSheetMetadataJob failed permanently', [
            'sheet_id' => $this->sheetId,
            'error' => $exception->getMessage(),
        ]);

        $sheet = QaStageDrawing::find($this->sheetId);
        if ($sheet) {
            $sheet->update([
                'extraction_status' => QaStageDrawing::EXTRACTION_FAILED,
                'extraction_errors' => [
                    'error' => $exception->getMessage(),
                    'failed_at' => now()->toIso8601String(),
                ],
            ]);

            if ($sheet->drawingSet) {
                $sheet->drawingSet->updateStatusFromSheets();
            }
        }
    }
}
