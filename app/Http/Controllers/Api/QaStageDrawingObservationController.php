<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\QaStageDrawing;
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
            'photo' => 'nullable|file|mimetypes:image/*|max:5120', // 5MB max
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
                'qa-drawing-observations/' . $validated['qa_stage_drawing_id'],
                time() . '_' . $photoName,
                'public'
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
            ]);

            $observation->load(['drawing', 'createdBy']);

            return response()->json($observation, 201);
        } catch (\Exception $e) {
            Log::error('Observation creation failed', [
                'qa_stage_drawing_id' => $validated['qa_stage_drawing_id'],
                'error' => $e->getMessage(),
            ]);

            if ($photoPath) {
                Storage::disk('public')->delete($photoPath);
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
            'photo' => 'nullable|file|mimetypes:image/*|max:5120',
            'remove_photo' => 'sometimes|boolean',
        ]);

        $photoPath = $qaStageDrawingObservation->photo_path;
        $photoName = $qaStageDrawingObservation->photo_name;
        $photoType = $qaStageDrawingObservation->photo_type;
        $photoSize = $qaStageDrawingObservation->photo_size;

        // Handle photo removal
        if ($request->boolean('remove_photo')) {
            if ($qaStageDrawingObservation->photo_path) {
                Storage::disk('public')->delete($qaStageDrawingObservation->photo_path);
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
                'qa-drawing-observations/' . $qaStageDrawingObservation->qa_stage_drawing_id,
                time() . '_' . $photoName,
                'public'
            );

            if ($qaStageDrawingObservation->photo_path) {
                Storage::disk('public')->delete($qaStageDrawingObservation->photo_path);
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

    public function destroy(QaStageDrawingObservation $qaStageDrawingObservation)
    {
        if ($qaStageDrawingObservation->photo_path) {
            Storage::disk('public')->delete($qaStageDrawingObservation->photo_path);
        }

        $qaStageDrawingObservation->delete();

        return response()->json(['message' => 'Observation deleted successfully']);
    }
}
