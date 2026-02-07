<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\QaStageDrawingObservation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class QaStageDrawingObservationController extends Controller
{
    public function index(Request $request)
    {
        $query = QaStageDrawingObservation::with(['drawing.qaStage', 'createdBy', 'updatedBy']);

        if ($request->has('qa_stage_drawing_id')) {
            $query->where('qa_stage_drawing_id', $request->qa_stage_drawing_id);
        }

        $observations = $query->orderBy('created_at', 'desc')->get();

        return response()->json($observations);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'qa_stage_drawing_id' => 'required|exists:qa_stage_drawings,id',
            'type' => 'required|string|in:defect,observation',
            'description' => 'required|string|max:2000',
            'page_number' => 'required|integer|min:1',
            'x' => 'required|numeric|min:0|max:1',
            'y' => 'required|numeric|min:0|max:1',
            'photo' => 'nullable|file|mimetypes:image/*|max:51200', // 50MB max (360 photos)
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
                'qa-drawing-observations/'.$validated['qa_stage_drawing_id'],
                time().'_'.$photoName,
                's3'
            );
        }

        try {
            $observation = QaStageDrawingObservation::create([
                'qa_stage_drawing_id' => $validated['qa_stage_drawing_id'],
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

            $observation->load(['drawing', 'createdBy']);

            return response()->json($observation, 201);
        } catch (\Exception $e) {
            Log::error('Observation creation failed', [
                'qa_stage_drawing_id' => $validated['qa_stage_drawing_id'],
                'error' => $e->getMessage(),
            ]);

            if ($photoPath) {
                Storage::disk('s3')->delete($photoPath);
            }

            return response()->json(['message' => 'Failed to save observation.'], 500);
        }
    }

    public function show(QaStageDrawingObservation $qaStageDrawingObservation)
    {
        $qaStageDrawingObservation->load(['drawing.qaStage.location', 'createdBy', 'updatedBy']);

        return response()->json($qaStageDrawingObservation);
    }

    public function update(Request $request, QaStageDrawingObservation $qaStageDrawingObservation)
    {
        $validated = $request->validate([
            'type' => 'sometimes|required|string|in:defect,observation',
            'description' => 'sometimes|required|string|max:2000',
            'page_number' => 'sometimes|required|integer|min:1',
            'x' => 'sometimes|required|numeric|min:0|max:1',
            'y' => 'sometimes|required|numeric|min:0|max:1',
            'photo' => 'nullable|file|mimetypes:image/*|max:51200', // 50MB max (360 photos)
            'remove_photo' => 'sometimes|boolean',
            'is_360_photo' => 'nullable|boolean',
        ]);

        $photoPath = $qaStageDrawingObservation->photo_path;
        $photoName = $qaStageDrawingObservation->photo_name;
        $photoType = $qaStageDrawingObservation->photo_type;
        $photoSize = $qaStageDrawingObservation->photo_size;

        // Handle photo removal
        if ($request->boolean('remove_photo')) {
            if ($qaStageDrawingObservation->photo_path) {
                Storage::disk('s3')->delete($qaStageDrawingObservation->photo_path);
            }
            $photoPath = null;
            $photoName = null;
            $photoType = null;
            $photoSize = null;
        } elseif ($request->hasFile('photo')) {
            $photo = $request->file('photo');
            $photoName = $photo->getClientOriginalName();
            $photoType = $photo->getClientMimeType();
            $photoSize = $photo->getSize();
            $photoPath = $photo->storeAs(
                'qa-drawing-observations/'.$qaStageDrawingObservation->qa_stage_drawing_id,
                time().'_'.$photoName,
                's3'
            );

            if ($qaStageDrawingObservation->photo_path) {
                Storage::disk('s3')->delete($qaStageDrawingObservation->photo_path);
            }
        }

        try {
            $qaStageDrawingObservation->update([
                'type' => $validated['type'] ?? $qaStageDrawingObservation->type,
                'description' => $validated['description'] ?? $qaStageDrawingObservation->description,
                'page_number' => $validated['page_number'] ?? $qaStageDrawingObservation->page_number,
                'x' => $validated['x'] ?? $qaStageDrawingObservation->x,
                'y' => $validated['y'] ?? $qaStageDrawingObservation->y,
                'photo_path' => $photoPath,
                'photo_name' => $photoName,
                'photo_type' => $photoType,
                'photo_size' => $photoSize,
                'is_360_photo' => $request->has('is_360_photo')
                    ? $request->boolean('is_360_photo')
                    : $qaStageDrawingObservation->is_360_photo,
            ]);

            $qaStageDrawingObservation->load(['drawing', 'createdBy', 'updatedBy']);

            return response()->json($qaStageDrawingObservation);
        } catch (\Exception $e) {
            Log::error('Observation update failed', [
                'observation_id' => $qaStageDrawingObservation->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to update observation.'], 500);
        }
    }

    public function photo(QaStageDrawingObservation $qaStageDrawingObservation)
    {
        if (! $qaStageDrawingObservation->photo_path) {
            return response()->json(['message' => 'No photo found.'], 404);
        }

        if (! Storage::disk('s3')->exists($qaStageDrawingObservation->photo_path)) {
            return response()->json(['message' => 'Photo file not found.'], 404);
        }

        $stream = Storage::disk('s3')->readStream($qaStageDrawingObservation->photo_path);

        return response()->stream(function () use ($stream) {
            fpassthru($stream);
        }, 200, [
            'Content-Type' => $qaStageDrawingObservation->photo_type ?? 'image/jpeg',
            'Content-Disposition' => 'inline; filename="'.($qaStageDrawingObservation->photo_name ?? 'photo.jpg').'"',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    public function destroy(QaStageDrawingObservation $qaStageDrawingObservation)
    {
        if ($qaStageDrawingObservation->photo_path) {
            Storage::disk('s3')->delete($qaStageDrawingObservation->photo_path);
        }

        $qaStageDrawingObservation->delete();

        return response()->json(['message' => 'Observation deleted successfully']);
    }
}
