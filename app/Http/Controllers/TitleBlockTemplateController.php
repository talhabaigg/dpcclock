<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\Drawing;
use App\Models\TitleBlockTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TitleBlockTemplateController extends Controller
{
    /**
     * List all templates for a project.
     */
    public function index(Location $project): JsonResponse
    {
        $templates = TitleBlockTemplate::where('project_id', $project->id)
            ->withCount('usedBySheets')
            ->orderByDesc('success_count')
            ->get();

        return response()->json([
            'success' => true,
            'templates' => $templates,
        ]);
    }

    /**
     * Create a new template from a user-drawn capture box.
     */
    public function store(Request $request, Location $project): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'crop_rect' => ['required', 'array'],
            'crop_rect.x' => ['required', 'numeric', 'min:0', 'max:1'],
            'crop_rect.y' => ['required', 'numeric', 'min:0', 'max:1'],
            'crop_rect.w' => ['required', 'numeric', 'min:0.01', 'max:1'],
            'crop_rect.h' => ['required', 'numeric', 'min:0.01', 'max:1'],
            'orientation' => ['nullable', 'in:portrait,landscape'],
            'size_bucket' => ['nullable', 'string', 'max:50'],
            'source_sheet_id' => ['nullable', 'integer', 'exists:drawings,id'],
            'anchor_labels' => ['nullable', 'array'],
        ]);

        // If source sheet provided, derive orientation and size bucket from it
        if (! empty($validated['source_sheet_id'])) {
            $sourceSheet = Drawing::find($validated['source_sheet_id']);
            if ($sourceSheet) {
                $validated['orientation'] = $validated['orientation'] ?? $sourceSheet->page_orientation;
                $validated['size_bucket'] = $validated['size_bucket'] ?? $sourceSheet->size_bucket;
            }
        }

        $template = TitleBlockTemplate::create([
            'project_id' => $project->id,
            'name' => $validated['name'],
            'crop_rect' => $validated['crop_rect'],
            'orientation' => $validated['orientation'] ?? null,
            'size_bucket' => $validated['size_bucket'] ?? null,
            'anchor_labels' => $validated['anchor_labels'] ?? null,
            'success_count' => 0,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Template created successfully.',
            'template' => $template,
        ], 201);
    }

    /**
     * Update an existing template.
     */
    public function update(Request $request, TitleBlockTemplate $template): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'crop_rect' => ['sometimes', 'array'],
            'crop_rect.x' => ['required_with:crop_rect', 'numeric', 'min:0', 'max:1'],
            'crop_rect.y' => ['required_with:crop_rect', 'numeric', 'min:0', 'max:1'],
            'crop_rect.w' => ['required_with:crop_rect', 'numeric', 'min:0.01', 'max:1'],
            'crop_rect.h' => ['required_with:crop_rect', 'numeric', 'min:0.01', 'max:1'],
            'orientation' => ['nullable', 'in:portrait,landscape'],
            'size_bucket' => ['nullable', 'string', 'max:50'],
            'anchor_labels' => ['nullable', 'array'],
        ]);

        $template->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Template updated successfully.',
            'template' => $template->fresh(),
        ]);
    }

    /**
     * Delete a template.
     */
    public function destroy(TitleBlockTemplate $template): JsonResponse
    {
        $template->delete();

        return response()->json([
            'success' => true,
            'message' => 'Template deleted successfully.',
        ]);
    }

    /**
     * Test a template on a specific sheet (without saving).
     */
    public function test(Request $request, TitleBlockTemplate $template): JsonResponse
    {
        $validated = $request->validate([
            'sheet_id' => ['required', 'integer', 'exists:drawings,id'],
        ]);

        $sheet = Drawing::findOrFail($validated['sheet_id']);

        if (! $sheet->page_preview_s3_key) {
            return response()->json([
                'success' => false,
                'message' => 'Sheet has no preview image to test against.',
            ], 422);
        }

        // Get services
        $textract = app(\App\Services\TextractService::class);
        $cropService = app(\App\Services\ImageCropService::class);
        $validator = app(\App\Services\DrawingMetadataValidationService::class);

        // Crop image using template
        $croppedBytes = $cropService->cropImage(
            $sheet->page_preview_s3_key,
            $template->crop_rect,
            's3'
        );

        if (! $croppedBytes) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to crop image with template.',
            ], 500);
        }

        // Extract with Textract
        $textractResult = $textract->extractFromBytes($croppedBytes);

        if (! $textractResult['success']) {
            return response()->json([
                'success' => false,
                'message' => 'Textract extraction failed: '.($textractResult['error'] ?? 'Unknown error'),
            ], 500);
        }

        // Validate results
        $validation = $validator->validate($textractResult['fields']);

        return response()->json([
            'success' => true,
            'extraction' => [
                'fields' => $textractResult['fields'],
                'validation' => $validation,
                'passes' => $validation['passes'],
                'overall_confidence' => $validator->calculateOverallConfidence($validation),
            ],
        ]);
    }

    /**
     * Detect all text blocks within a sheet's cropped title block region.
     * Used for the field mapping UI where users can select which text belongs to which field.
     */
    public function detectTextBlocks(Request $request, Drawing $sheet): JsonResponse
    {
        // Increase memory limit for large images (300 DPI drawings can be 200MB+ uncompressed)
        ini_set('memory_limit', '1G');

        $validated = $request->validate([
            'crop_rect' => ['required', 'array'],
            'crop_rect.x' => ['required', 'numeric', 'min:0', 'max:1'],
            'crop_rect.y' => ['required', 'numeric', 'min:0', 'max:1'],
            'crop_rect.w' => ['required', 'numeric', 'min:0.01', 'max:1'],
            'crop_rect.h' => ['required', 'numeric', 'min:0.01', 'max:1'],
        ]);

        if (! $sheet->page_preview_s3_key) {
            return response()->json([
                'success' => false,
                'message' => 'Sheet has no preview image.',
            ], 422);
        }

        $textract = app(\App\Services\TextractService::class);
        $cropService = app(\App\Services\ImageCropService::class);

        // Crop image using provided crop rect
        $croppedBytes = $cropService->cropImage(
            $sheet->page_preview_s3_key,
            $validated['crop_rect'],
            's3'
        );

        if (! $croppedBytes) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to crop image.',
            ], 500);
        }

        // Get image dimensions of the cropped region for coordinate mapping
        $tempImage = imagecreatefromstring($croppedBytes);
        $croppedWidth = imagesx($tempImage);
        $croppedHeight = imagesy($tempImage);
        imagedestroy($tempImage);

        \Log::info('detectTextBlocks: Cropped image ready', [
            'sheet_id' => $sheet->id,
            'crop_rect' => $validated['crop_rect'],
            'cropped_size' => strlen($croppedBytes),
            'cropped_dimensions' => "{$croppedWidth}x{$croppedHeight}",
        ]);

        // Detect all text in the cropped region
        $result = $textract->detectAllText($croppedBytes);

        \Log::info('detectTextBlocks: Textract result', [
            'success' => $result['success'],
            'text_blocks_count' => count($result['text_blocks'] ?? []),
            'error' => $result['error'] ?? null,
        ]);

        if (! $result['success']) {
            return response()->json([
                'success' => false,
                'message' => 'Textract text detection failed: '.($result['error'] ?? 'Unknown error'),
            ], 500);
        }

        // Convert bounding boxes from cropped-region-relative to full-crop-relative
        // (The text blocks have coordinates relative to the cropped image, 0-1 normalized)
        $textBlocks = $result['text_blocks'];

        return response()->json([
            'success' => true,
            'text_blocks' => $textBlocks,
            'crop_dimensions' => [
                'width' => $croppedWidth,
                'height' => $croppedHeight,
            ],
        ]);
    }

    /**
     * Save field mappings to a template.
     * Field mappings specify which text blocks correspond to which metadata fields.
     */
    public function saveFieldMappings(Request $request, TitleBlockTemplate $template): JsonResponse
    {
        $validated = $request->validate([
            'field_mappings' => ['required', 'array'],
            'field_mappings.drawing_number' => ['nullable', 'array'],
            'field_mappings.drawing_number.text' => ['nullable', 'string'],
            'field_mappings.drawing_number.boundingBox' => ['nullable', 'array'],
            'field_mappings.drawing_title' => ['nullable', 'array'],
            'field_mappings.drawing_title.text' => ['nullable', 'string'],
            'field_mappings.drawing_title.boundingBox' => ['nullable', 'array'],
            'field_mappings.revision' => ['nullable', 'array'],
            'field_mappings.revision.text' => ['nullable', 'string'],
            'field_mappings.revision.boundingBox' => ['nullable', 'array'],
        ]);

        $template->update([
            'field_mappings' => $validated['field_mappings'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Field mappings saved successfully.',
            'template' => $template->fresh(),
        ]);
    }

    /**
     * Create a template from a sheet's successful extraction.
     */
    public function createFromSheet(Request $request, Drawing $sheet): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'crop_rect' => ['required', 'array'],
            'crop_rect.x' => ['required', 'numeric', 'min:0', 'max:1'],
            'crop_rect.y' => ['required', 'numeric', 'min:0', 'max:1'],
            'crop_rect.w' => ['required', 'numeric', 'min:0.01', 'max:1'],
            'crop_rect.h' => ['required', 'numeric', 'min:0.01', 'max:1'],
        ]);

        if (! $sheet->project_id) {
            return response()->json([
                'success' => false,
                'message' => 'Drawing has no project assigned.',
            ], 422);
        }

        $template = TitleBlockTemplate::create([
            'project_id' => $sheet->project_id,
            'name' => $validated['name'],
            'crop_rect' => $validated['crop_rect'],
            'orientation' => $sheet->page_orientation,
            'size_bucket' => $sheet->size_bucket,
            'success_count' => 1, // Start with 1 since it worked for this sheet
            'last_used_at' => now(),
        ]);

        // If extraction was successful, link template
        if ($sheet->extraction_status === Drawing::EXTRACTION_SUCCESS) {
            $sheet->update(['used_template_id' => $template->id]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Template created from sheet.',
            'template' => $template,
        ], 201);
    }
}
