<?php

namespace App\Jobs;

use App\Events\DrawingSetProcessingUpdated;
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
        public int $sheetId,
        public ?int $preferredTemplateId = null
    ) {}

    public function handle(
        TextractService $textract,
        ImageCropService $cropService,
        DrawingMetadataValidationService $validator
    ): void {
        // Increase memory limit for large images (300 DPI drawings can be 200MB+ uncompressed)
        ini_set('memory_limit', '1G');

        // Debug: Log job parameters immediately
        Log::info('ExtractSheetMetadataJob started', [
            'sheet_id' => $this->sheetId,
            'preferred_template_id' => $this->preferredTemplateId,
            'has_preferred_template' => $this->preferredTemplateId !== null,
        ]);

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
            // Attempt 1: Try preferred template if specified (user explicitly chose this template)
            $usedPreferredTemplate = false;
            if ($this->preferredTemplateId && $projectId) {
                $preferredTemplate = TitleBlockTemplate::where('id', $this->preferredTemplateId)
                    ->where('project_id', $projectId)
                    ->first();

                if ($preferredTemplate) {
                    Log::info('Using preferred template for extraction', [
                        'sheet_id' => $sheet->id,
                        'template_id' => $preferredTemplate->id,
                        'template_name' => $preferredTemplate->name,
                    ]);

                    $result = $this->extractWithTemplate(
                        $sheet, $preferredTemplate, $textract, $cropService, $validator
                    );
                    $result['used_template_id'] = $preferredTemplate->id;
                    $allAttempts[] = [
                        'method' => 'preferred_template',
                        'template_id' => $preferredTemplate->id,
                        'result' => $result,
                    ];

                    $bestResult = $result;
                    $usedPreferredTemplate = true;

                    if ($result['passes']) {
                        $preferredTemplate->recordSuccess();
                    }
                    // Don't try other templates - user specifically chose this one
                }
            }

            // Attempt 2: Try auto-selected templates if no preferred template was used
            if (!$usedPreferredTemplate && $projectId) {
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
        Log::info('Starting template extraction', [
            'sheet_id' => $sheet->id,
            'template_id' => $template->id,
            'crop_rect' => $template->crop_rect,
            'has_field_mappings' => !empty($template->field_mappings),
        ]);

        // If template has field mappings, extract directly from those regions
        if (!empty($template->field_mappings)) {
            return $this->extractWithFieldMappings(
                $sheet, $template, $textract, $cropService, $validator
            );
        }

        // Otherwise, use query-based extraction on cropped region
        // Crop image using template
        $croppedBytes = $cropService->cropImage(
            $sheet->page_preview_s3_key,
            $template->crop_rect,
            's3'
        );

        if (!$croppedBytes) {
            Log::warning('Template crop failed', ['sheet_id' => $sheet->id, 'template_id' => $template->id]);
            return [
                'passes' => false,
                'error' => 'Failed to crop image with template',
                'overall_confidence' => 0,
            ];
        }

        Log::info('Template crop successful', [
            'sheet_id' => $sheet->id,
            'cropped_size' => strlen($croppedBytes),
        ]);

        // Extract with Textract
        $textractResult = $textract->extractFromBytes($croppedBytes);

        Log::info('Textract result', [
            'sheet_id' => $sheet->id,
            'success' => $textractResult['success'],
            'fields' => $textractResult['fields'] ?? null,
            'error' => $textractResult['error'] ?? null,
        ]);

        if (!$textractResult['success']) {
            return [
                'passes' => false,
                'error' => $textractResult['error'] ?? 'Textract extraction failed',
                'overall_confidence' => 0,
            ];
        }

        // Validate results
        $validation = $validator->validate($textractResult['fields']);

        Log::info('Validation result', [
            'sheet_id' => $sheet->id,
            'passes' => $validation['passes'],
            'validation' => $validation,
        ]);

        return [
            'passes' => $validation['passes'],
            'fields' => $textractResult['fields'],
            'validation' => $validation,
            'raw' => $textractResult['raw'],
            'overall_confidence' => $validator->calculateOverallConfidence($validation),
        ];
    }

    /**
     * Extract using template's field mappings (user-drawn field regions).
     *
     * When a template has field_mappings, we extract text directly from each
     * field's specific region instead of using Textract queries.
     *
     * Field mappings contain boundingBox coordinates relative to the template's crop_rect.
     * Small regions are automatically padded to ensure Textract can process them.
     */
    private function extractWithFieldMappings(
        QaStageDrawing $sheet,
        TitleBlockTemplate $template,
        TextractService $textract,
        ImageCropService $cropService,
        DrawingMetadataValidationService $validator
    ): array {
        $fieldMappings = $template->field_mappings;
        $cropRect = $template->crop_rect;
        $fields = [];

        Log::info('Using field mappings for extraction', [
            'sheet_id' => $sheet->id,
            'template_id' => $template->id,
            'template_name' => $template->name,
            'crop_rect' => $cropRect,
            'field_mappings_keys' => array_keys($fieldMappings ?? []),
            'field_mappings_raw' => $fieldMappings,
        ]);

        foreach (['drawing_number', 'drawing_title', 'revision'] as $fieldName) {
            if (!isset($fieldMappings[$fieldName])) {
                Log::info("Field mapping not set for: {$fieldName}", [
                    'sheet_id' => $sheet->id,
                ]);
                $fields[$fieldName] = [
                    'text' => '',
                    'confidence' => 0,
                    'source_alias' => $fieldName,
                    'boundingBox' => null,
                ];
                continue;
            }

            $mapping = $fieldMappings[$fieldName];

            Log::info("Processing field mapping: {$fieldName}", [
                'sheet_id' => $sheet->id,
                'mapping' => $mapping,
                'has_boundingBox' => isset($mapping['boundingBox']),
            ]);

            // Get boundingBox - coordinates are relative to the crop region
            $fieldRect = null;
            if (isset($mapping['boundingBox']) && $mapping['boundingBox']) {
                $bb = $mapping['boundingBox'];

                Log::info("Converting {$fieldName} coordinates from crop-relative to full image", [
                    'sheet_id' => $sheet->id,
                    'crop_rect' => $cropRect,
                    'original_bb' => $bb,
                ]);

                // Convert from crop-relative to full image coordinates
                $fieldRect = [
                    'x' => $cropRect['x'] + ($bb['x'] * $cropRect['w']),
                    'y' => $cropRect['y'] + ($bb['y'] * $cropRect['h']),
                    'w' => $bb['w'] * $cropRect['w'],
                    'h' => $bb['h'] * $cropRect['h'],
                ];

                Log::info("Converted {$fieldName} to full image coordinates", [
                    'sheet_id' => $sheet->id,
                    'fieldRect' => $fieldRect,
                ]);
            } elseif (isset($mapping['x']) && isset($mapping['y']) && isset($mapping['w']) && isset($mapping['h'])) {
                // Legacy format: direct coordinates on full image
                $fieldRect = $mapping;
                Log::info("Using legacy format for {$fieldName}", [
                    'sheet_id' => $sheet->id,
                    'fieldRect' => $fieldRect,
                ]);
            }

            if (!$fieldRect) {
                Log::warning('Invalid field mapping format - no valid coordinates', [
                    'sheet_id' => $sheet->id,
                    'field' => $fieldName,
                    'mapping' => $mapping,
                ]);
                $fields[$fieldName] = [
                    'text' => '',
                    'confidence' => 0,
                    'source_alias' => $fieldName,
                    'boundingBox' => null,
                ];
                continue;
            }

            Log::info('Extracting from user-drawn field region', [
                'sheet_id' => $sheet->id,
                'field' => $fieldName,
                'fieldRect' => $fieldRect,
            ]);

            // Add padding to small regions to ensure Textract can process them
            // Small single-character fields (like revision "F") need more context
            $paddedRect = $this->addPaddingToSmallRegion($fieldRect, $fieldName);

            if ($paddedRect !== $fieldRect) {
                Log::info("Added padding to small region for {$fieldName}", [
                    'sheet_id' => $sheet->id,
                    'original' => $fieldRect,
                    'padded' => $paddedRect,
                ]);
            }

            // Crop using the (potentially padded) region
            $fieldCroppedBytes = $cropService->cropImage(
                $sheet->page_preview_s3_key,
                $paddedRect,
                's3'
            );

            if (!$fieldCroppedBytes) {
                Log::warning('Field crop failed', [
                    'sheet_id' => $sheet->id,
                    'field' => $fieldName,
                    'fieldRect' => $fieldRect,
                ]);
                $fields[$fieldName] = [
                    'text' => '',
                    'confidence' => 0,
                    'source_alias' => $fieldName,
                    'boundingBox' => null,
                ];
                continue;
            }

            // Log the cropped image size for debugging
            $croppedImageSize = strlen($fieldCroppedBytes);
            Log::info("Cropped region for {$fieldName}", [
                'sheet_id' => $sheet->id,
                'cropped_bytes_size' => $croppedImageSize,
                'fieldRect' => $fieldRect,
            ]);

            // Extract all text from the field region and join it
            $result = $textract->extractAllTextFromRegion($fieldCroppedBytes);

            $extractedText = $result['text'] ?? '';
            $extractedConfidence = $result['confidence'] ?? 0;

            Log::info('Field mapping extraction result', [
                'sheet_id' => $sheet->id,
                'field' => $fieldName,
                'extracted_text' => $extractedText,
                'text_length' => strlen($extractedText),
                'confidence' => $extractedConfidence,
                'success' => $result['success'] ?? false,
                'error' => $result['error'] ?? null,
            ]);

            $fields[$fieldName] = [
                'text' => $extractedText,
                'confidence' => $extractedConfidence,
                'source_alias' => $fieldName,
                'boundingBox' => $fieldRect,
            ];
        }

        // When using field mappings, we trust the user's selections
        // Skip strict validation - just check that we got some text
        $validation = $validator->validate($fields, skipStrictChecks: true);

        return [
            'passes' => $validation['passes'],
            'fields' => $fields,
            'validation' => $validation,
            'raw' => [],
            'overall_confidence' => $validator->calculateOverallConfidence($validation),
            'used_field_mappings' => true,
        ];
    }

    /**
     * Add padding to small field regions to ensure Textract can process them.
     *
     * Small regions (like single-character revision fields) produce tiny cropped
     * images that Textract cannot detect text in. This method ensures regions
     * meet minimum size thresholds by adding symmetric padding.
     *
     * @param array $rect {x, y, w, h} normalized coordinates (0-1)
     * @param string $fieldName For logging purposes
     * @return array Padded rect (clamped to 0-1 bounds)
     */
    private function addPaddingToSmallRegion(array $rect, string $fieldName): array
    {
        // Minimum dimensions as fraction of image
        // Too small = Textract can't detect text
        // Too large = captures surrounding text
        $minWidth = 0.025;
        $minHeight = 0.02;

        // Revision fields need more padding to ensure Textract captures the letter
        // Some sheets have the revision letter detected, others don't - more context helps
        if ($fieldName === 'revision') {
            $minWidth = 0.045;
            $minHeight = 0.035;
        }

        $x = $rect['x'];
        $y = $rect['y'];
        $w = $rect['w'];
        $h = $rect['h'];

        // Calculate how much padding is needed (if any)
        $needsWidthPadding = $w < $minWidth;
        $needsHeightPadding = $h < $minHeight;

        if (!$needsWidthPadding && !$needsHeightPadding) {
            return $rect;
        }

        // Calculate new dimensions
        $newW = max($w, $minWidth);
        $newH = max($h, $minHeight);

        // Calculate padding to add on each side (symmetric)
        $padX = ($newW - $w) / 2;
        $padY = ($newH - $h) / 2;

        // Apply padding, keeping the center point the same
        $newX = $x - $padX;
        $newY = $y - $padY;

        // Clamp to image bounds (0-1)
        // If we hit a boundary, shift the region inward
        if ($newX < 0) {
            $newX = 0;
        }
        if ($newY < 0) {
            $newY = 0;
        }
        if ($newX + $newW > 1) {
            $newX = max(0, 1 - $newW);
        }
        if ($newY + $newH > 1) {
            $newY = max(0, 1 - $newH);
        }

        // Final clamp on dimensions
        $newW = min($newW, 1 - $newX);
        $newH = min($newH, 1 - $newY);

        return [
            'x' => $newX,
            'y' => $newY,
            'w' => $newW,
            'h' => $newH,
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
                'used_field_mappings' => $result['used_field_mappings'] ?? false,
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
            $drawingSet = $sheet->drawingSet->fresh();

            // Broadcast real-time update
            $this->broadcastProgress($sheet, $drawingSet, $updateData);
        }
    }

    /**
     * Broadcast extraction progress for real-time UI updates.
     */
    private function broadcastProgress(QaStageDrawing $sheet, $drawingSet, array $updateData): void
    {
        try {
            // Calculate stats for the drawing set
            $stats = [
                'total' => $drawingSet->page_count,
                'queued' => $drawingSet->sheets()->where('extraction_status', 'queued')->count(),
                'processing' => $drawingSet->sheets()->where('extraction_status', 'processing')->count(),
                'success' => $drawingSet->sheets()->where('extraction_status', 'success')->count(),
                'needs_review' => $drawingSet->sheets()->where('extraction_status', 'needs_review')->count(),
                'failed' => $drawingSet->sheets()->where('extraction_status', 'failed')->count(),
            ];

            // Get thumbnail URL from first sheet if available
            $thumbnailUrl = null;
            $firstSheet = $drawingSet->sheets()->where('page_number', 1)->first();
            if ($firstSheet && $firstSheet->thumbnail_s3_key) {
                $thumbnailUrl = "/drawing-sheets/{$firstSheet->id}/thumbnail";
            }

            Log::info('Broadcasting extraction progress', [
                'drawing_set_id' => $drawingSet->id,
                'sheet_id' => $sheet->id,
                'status' => $drawingSet->status,
                'stats' => $stats,
                'thumbnail_url' => $thumbnailUrl,
            ]);

            event(new DrawingSetProcessingUpdated(
                projectId: $drawingSet->project_id,
                drawingSetId: $drawingSet->id,
                status: $drawingSet->status,
                sheetId: $sheet->id,
                pageNumber: $sheet->page_number,
                extractionStatus: $updateData['extraction_status'] ?? null,
                drawingNumber: $updateData['drawing_number'] ?? null,
                drawingTitle: $updateData['drawing_title'] ?? null,
                revision: $updateData['revision'] ?? null,
                stats: $stats,
                thumbnailUrl: $thumbnailUrl
            ));
        } catch (\Exception $e) {
            // Don't fail the job if broadcasting fails
            Log::warning('Failed to broadcast extraction progress', [
                'sheet_id' => $sheet->id,
                'error' => $e->getMessage(),
            ]);
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
            // Pass the sheet's creator as fallback since we're in a job context without auth
            $drawingSheet = DrawingSheet::findOrCreateByDrawingNumber(
                $projectId,
                $drawingNumber,
                $title,
                null, // discipline
                $sheet->created_by // Pass original uploader as creator
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

        $sheet = QaStageDrawing::with('drawingSet')->find($this->sheetId);
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
                $drawingSet = $sheet->drawingSet->fresh();

                // Broadcast failure status
                $this->broadcastProgress($sheet, $drawingSet, [
                    'extraction_status' => QaStageDrawing::EXTRACTION_FAILED,
                    'drawing_number' => $sheet->drawing_number,
                    'drawing_title' => $sheet->drawing_title,
                    'revision' => $sheet->revision,
                ]);
            }
        }
    }
}
