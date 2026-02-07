<?php

namespace App\Http\Controllers;

use App\Models\QaStageDrawing;
use App\Models\QaStageDrawingObservation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class QaStageDrawingObservationController extends Controller
{
    public function store(Request $request, QaStageDrawing $drawing)
    {
        $validated = $request->validate([
            'type' => 'required|string|in:defect,observation',
            'description' => 'required|string|max:2000',
            'page_number' => 'required|integer|min:1',
            'x' => 'required|numeric|min:0|max:1',
            'y' => 'required|numeric|min:0|max:1',
            'photo' => 'nullable|image|max:51200', // 50MB max (360 photos)
            'is_360_photo' => 'nullable|boolean',
        ]);

        $photoPath = null;
        $photoName = null;
        $photoType = null;
        $photoSize = null;

        if ($request->hasFile('photo')) {
            $photo = $request->file('photo');
            $photoName = $photo->getClientOriginalName();
            $photoType = $photo->getClientMimeType();
            $photoSize = $photo->getSize();
            $photoPath = $photo->storeAs(
                'qa-drawing-observations/'.$drawing->id,
                time().'_'.$photoName,
                'public'
            );
        }

        try {
            $observation = QaStageDrawingObservation::create([
                'qa_stage_drawing_id' => $drawing->id,
                'page_number' => $validated['page_number'],
                'x' => $validated['x'],
                'y' => $validated['y'],
                'type' => $validated['type'],
                'description' => $validated['description'],
                'photo_path' => $photoPath,
                'photo_name' => $photoName,
                'photo_type' => $photoType,
                'photo_size' => $photoSize,
                'is_360_photo' => $request->boolean('is_360_photo'),
            ]);

            return response()->json($observation->fresh());
        } catch (\Exception $e) {
            Log::error('Observation creation failed', [
                'drawing_id' => $drawing->id,
                'error' => $e->getMessage(),
            ]);

            if ($photoPath) {
                Storage::disk('public')->delete($photoPath);
            }

            return response()->json(['message' => 'Failed to save observation.'], 500);
        }
    }

    public function update(Request $request, QaStageDrawing $drawing, QaStageDrawingObservation $observation)
    {
        if ($observation->qa_stage_drawing_id !== $drawing->id) {
            abort(404);
        }

        $validated = $request->validate([
            'type' => 'required|string|in:defect,observation',
            'description' => 'required|string|max:2000',
            'page_number' => 'required|integer|min:1',
            'x' => 'required|numeric|min:0|max:1',
            'y' => 'required|numeric|min:0|max:1',
            'photo' => 'nullable|image|max:51200', // 50MB max (360 photos)
            'is_360_photo' => 'nullable|boolean',
        ]);

        $photoPath = $observation->photo_path;
        $photoName = $observation->photo_name;
        $photoType = $observation->photo_type;
        $photoSize = $observation->photo_size;

        if ($request->hasFile('photo')) {
            $photo = $request->file('photo');
            $photoName = $photo->getClientOriginalName();
            $photoType = $photo->getClientMimeType();
            $photoSize = $photo->getSize();
            $photoPath = $photo->storeAs(
                'qa-drawing-observations/'.$drawing->id,
                time().'_'.$photoName,
                'public'
            );

            if ($observation->photo_path) {
                Storage::disk('public')->delete($observation->photo_path);
            }
        }

        try {
            $observation->update([
                'type' => $validated['type'],
                'description' => $validated['description'],
                'page_number' => $validated['page_number'],
                'x' => $validated['x'],
                'y' => $validated['y'],
                'photo_path' => $photoPath,
                'photo_name' => $photoName,
                'photo_type' => $photoType,
                'photo_size' => $photoSize,
                'is_360_photo' => $request->has('is_360_photo')
                    ? $request->boolean('is_360_photo')
                    : $observation->is_360_photo,
            ]);

            return response()->json($observation->fresh());
        } catch (\Exception $e) {
            Log::error('Observation update failed', [
                'drawing_id' => $drawing->id,
                'observation_id' => $observation->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to update observation.'], 500);
        }
    }

    /**
     * Confirm an AI-generated observation.
     */
    public function confirm(QaStageDrawing $drawing, QaStageDrawingObservation $observation)
    {
        if ($observation->qa_stage_drawing_id !== $drawing->id) {
            abort(404);
        }

        if ($observation->source !== 'ai_comparison') {
            return response()->json(['message' => 'Only AI-generated observations can be confirmed.'], 422);
        }

        if ($observation->is_confirmed) {
            return response()->json(['message' => 'Observation is already confirmed.'], 422);
        }

        try {
            $observation->update([
                'is_confirmed' => true,
                'confirmed_at' => now(),
                'confirmed_by' => auth()->id(),
            ]);

            return response()->json($observation->fresh());
        } catch (\Exception $e) {
            Log::error('Observation confirmation failed', [
                'drawing_id' => $drawing->id,
                'observation_id' => $observation->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to confirm observation.'], 500);
        }
    }

    /**
     * Delete an observation.
     */
    public function destroy(QaStageDrawing $drawing, QaStageDrawingObservation $observation)
    {
        if ($observation->qa_stage_drawing_id !== $drawing->id) {
            abort(404);
        }

        try {
            // Delete associated photo if exists
            if ($observation->photo_path) {
                Storage::disk('public')->delete($observation->photo_path);
            }

            $observation->delete();

            return response()->json(['message' => 'Observation deleted successfully.']);
        } catch (\Exception $e) {
            Log::error('Observation deletion failed', [
                'drawing_id' => $drawing->id,
                'observation_id' => $observation->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to delete observation.'], 500);
        }
    }

    /**
     * Stream observation photo from S3 (same-origin proxy for 360 viewer).
     */
    public function photo(QaStageDrawingObservation $observation)
    {
        if (! $observation->photo_path) {
            abort(404, 'No photo available');
        }

        $disk = Storage::disk('s3');

        if (! $disk->exists($observation->photo_path)) {
            abort(404, 'Photo not found');
        }

        return response()->stream(function () use ($disk, $observation) {
            $stream = $disk->readStream($observation->photo_path);
            fpassthru($stream);
            fclose($stream);
        }, 200, [
            'Content-Type' => $observation->photo_type ?? 'image/jpeg',
            'Content-Disposition' => 'inline',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    /**
     * Describe an AI observation using GPT-4o (on-demand).
     */
    public function describe(QaStageDrawing $drawing, QaStageDrawingObservation $observation)
    {
        if ($observation->qa_stage_drawing_id !== $drawing->id) {
            abort(404);
        }

        // Only AI observations can be described (they have source sheets)
        if ($observation->source !== 'ai_comparison') {
            return response()->json([
                'success' => false,
                'message' => 'Only AI-detected observations can be described.',
            ], 422);
        }

        // Get the source QaStageDrawings (not DrawingSheets)
        $qaDrawingA = \App\Models\QaStageDrawing::find($observation->source_sheet_a_id);
        $qaDrawingB = \App\Models\QaStageDrawing::find($observation->source_sheet_b_id);

        if (! $qaDrawingA || ! $qaDrawingB) {
            return response()->json([
                'success' => false,
                'message' => 'Source drawings not found.',
            ], 404);
        }

        // Get file paths - use page_preview_s3_key or thumbnail_path (same as comparison)
        $filePathA = $qaDrawingA->page_preview_s3_key ?: $qaDrawingA->thumbnail_path;
        $filePathB = $qaDrawingB->page_preview_s3_key ?: $qaDrawingB->thumbnail_path;

        if (! $filePathA || ! $filePathB) {
            return response()->json([
                'success' => false,
                'message' => 'Source drawing preview images not found.',
            ], 404);
        }

        // Build bounding box from observation coordinates
        // Use stored CV dimensions if available, otherwise default to 15%
        $boundingBox = [
            'x' => $observation->x,
            'y' => $observation->y,
            'width' => $observation->bbox_width ?? 0.15,
            'height' => $observation->bbox_height ?? 0.15,
        ];

        try {
            $comparisonService = new \App\Services\DrawingComparisonService;
            $result = $comparisonService->describeRegionWithAI(
                $filePathA,
                $filePathB,
                $boundingBox,
                'walls and ceilings'
            );

            if (! $result['success']) {
                return response()->json([
                    'success' => false,
                    'message' => $result['error'] ?? 'Failed to describe region.',
                ], 500);
            }

            // Update the observation with AI description
            $observation->update([
                'description' => $result['description'],
                'ai_change_type' => $result['type'],
                'ai_impact' => $result['impact'],
                'ai_location' => $result['location'] ?? $result['room_name'],
                'potential_change_order' => $result['potential_change_order'] ?? false,
            ]);

            return response()->json([
                'success' => true,
                'observation' => $observation->fresh(),
                'ai_result' => $result,
            ]);

        } catch (\Exception $e) {
            Log::error('AI describe failed', [
                'observation_id' => $observation->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to describe observation: '.$e->getMessage(),
            ], 500);
        }
    }
}
