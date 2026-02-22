<?php

namespace App\Http\Controllers;

use App\Models\Drawing;
use App\Models\DrawingObservation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DrawingObservationController extends Controller
{
    public function store(Request $request, Drawing $drawing)
    {
        $validated = $request->validate([
            'type' => 'required|string|in:defect,observation',
            'description' => 'required|string|max:2000',
            'page_number' => 'required|integer|min:1',
            'x' => 'required|numeric|min:0|max:1',
            'y' => 'required|numeric|min:0|max:1',
            'photo' => 'nullable|image|max:51200',
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
                'drawing-observations/' . $drawing->id,
                time() . '_' . $photoName,
                's3'
            );
        }

        try {
            $observation = DrawingObservation::create([
                'drawing_id' => $drawing->id,
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
                Storage::disk('s3')->delete($photoPath);
            }

            return response()->json(['message' => 'Failed to save observation.'], 500);
        }
    }

    public function update(Request $request, Drawing $drawing, DrawingObservation $observation)
    {
        if ($observation->drawing_id !== $drawing->id) {
            abort(404);
        }

        $validated = $request->validate([
            'type' => 'required|string|in:defect,observation',
            'description' => 'required|string|max:2000',
            'page_number' => 'required|integer|min:1',
            'x' => 'required|numeric|min:0|max:1',
            'y' => 'required|numeric|min:0|max:1',
            'photo' => 'nullable|image|max:51200',
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
                'drawing-observations/' . $drawing->id,
                time() . '_' . $photoName,
                's3'
            );

            if ($observation->photo_path) {
                Storage::disk('s3')->delete($observation->photo_path);
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
                'observation_id' => $observation->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to update observation.'], 500);
        }
    }

    public function confirm(Drawing $drawing, DrawingObservation $observation)
    {
        if ($observation->drawing_id !== $drawing->id) {
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
            return response()->json(['message' => 'Failed to confirm observation.'], 500);
        }
    }

    public function bulkDestroy(Request $request, Drawing $drawing)
    {
        $validated = $request->validate([
            'observation_ids' => 'required|array|min:1',
            'observation_ids.*' => 'required|integer',
        ]);

        $observations = DrawingObservation::where('drawing_id', $drawing->id)
            ->whereIn('id', $validated['observation_ids'])
            ->get();

        $deleted = 0;
        $failed = 0;

        foreach ($observations as $observation) {
            try {
                if ($observation->photo_path) {
                    Storage::disk('s3')->delete($observation->photo_path);
                }
                $observation->delete();
                $deleted++;
            } catch (\Exception $e) {
                Log::error('Bulk observation delete failed', [
                    'observation_id' => $observation->id,
                    'error' => $e->getMessage(),
                ]);
                $failed++;
            }
        }

        return response()->json([
            'success' => $failed === 0,
            'deleted_count' => $deleted,
            'failed_count' => $failed,
        ]);
    }

    public function destroy(Drawing $drawing, DrawingObservation $observation)
    {
        if ($observation->drawing_id !== $drawing->id) {
            abort(404);
        }

        try {
            if ($observation->photo_path) {
                Storage::disk('s3')->delete($observation->photo_path);
            }

            $observation->delete();

            return response()->json(['message' => 'Observation deleted successfully.']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed to delete observation.'], 500);
        }
    }

    /**
     * Stream observation photo (same-origin proxy for 360 viewer).
     */
    public function photo(DrawingObservation $observation)
    {
        if (! $observation->photo_path) {
            abort(404, 'No photo available');
        }

        $disk = Storage::disk('s3');

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
     * Describe an AI observation using GPT-4o.
     */
    public function describe(Drawing $drawing, DrawingObservation $observation)
    {
        if ($observation->drawing_id !== $drawing->id) {
            abort(404);
        }

        if ($observation->source !== 'ai_comparison') {
            return response()->json([
                'success' => false,
                'message' => 'Only AI-detected observations can be described.',
            ], 422);
        }

        $drawingA = Drawing::find($observation->source_sheet_a_id);
        $drawingB = Drawing::find($observation->source_sheet_b_id);

        if (! $drawingA || ! $drawingB) {
            return response()->json([
                'success' => false,
                'message' => 'Source drawings not found.',
            ], 404);
        }

        $filePathA = $drawingA->page_preview_s3_key ?: $drawingA->thumbnail_path;
        $filePathB = $drawingB->page_preview_s3_key ?: $drawingB->thumbnail_path;

        if (! $filePathA || ! $filePathB) {
            return response()->json([
                'success' => false,
                'message' => 'Source drawing preview images not found.',
            ], 404);
        }

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
                'message' => 'Failed to describe observation: ' . $e->getMessage(),
            ], 500);
        }
    }
}
