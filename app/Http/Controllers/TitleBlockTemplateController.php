<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\QaStageDrawing;
use App\Models\TitleBlockTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

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
            'source_sheet_id' => ['nullable', 'integer', 'exists:qa_stage_drawings,id'],
            'anchor_labels' => ['nullable', 'array'],
        ]);

        // If source sheet provided, derive orientation and size bucket from it
        if (!empty($validated['source_sheet_id'])) {
            $sourceSheet = QaStageDrawing::find($validated['source_sheet_id']);
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
            'sheet_id' => ['required', 'integer', 'exists:qa_stage_drawings,id'],
        ]);

        $sheet = QaStageDrawing::findOrFail($validated['sheet_id']);

        if (!$sheet->page_preview_s3_key) {
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

        if (!$croppedBytes) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to crop image with template.',
            ], 500);
        }

        // Extract with Textract
        $textractResult = $textract->extractFromBytes($croppedBytes);

        if (!$textractResult['success']) {
            return response()->json([
                'success' => false,
                'message' => 'Textract extraction failed: ' . ($textractResult['error'] ?? 'Unknown error'),
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
     * Create a template from a sheet's successful extraction.
     */
    public function createFromSheet(Request $request, QaStageDrawing $sheet): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'crop_rect' => ['required', 'array'],
            'crop_rect.x' => ['required', 'numeric', 'min:0', 'max:1'],
            'crop_rect.y' => ['required', 'numeric', 'min:0', 'max:1'],
            'crop_rect.w' => ['required', 'numeric', 'min:0.01', 'max:1'],
            'crop_rect.h' => ['required', 'numeric', 'min:0.01', 'max:1'],
        ]);

        if (!$sheet->drawingSet) {
            return response()->json([
                'success' => false,
                'message' => 'Sheet is not part of a drawing set.',
            ], 422);
        }

        $template = TitleBlockTemplate::create([
            'project_id' => $sheet->drawingSet->project_id,
            'name' => $validated['name'],
            'crop_rect' => $validated['crop_rect'],
            'orientation' => $sheet->page_orientation,
            'size_bucket' => $sheet->size_bucket,
            'success_count' => 1, // Start with 1 since it worked for this sheet
            'last_used_at' => now(),
        ]);

        // If extraction was successful, link template
        if ($sheet->extraction_status === QaStageDrawing::EXTRACTION_SUCCESS) {
            $sheet->update(['used_template_id' => $template->id]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Template created from sheet.',
            'template' => $template,
        ], 201);
    }
}
