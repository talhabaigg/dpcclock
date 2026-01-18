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
            'photo' => 'nullable|image|max:5120',
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
                'qa-drawing-observations/' . $drawing->id,
                time() . '_' . $photoName,
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
            'photo' => 'nullable|image|max:5120',
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
                'qa-drawing-observations/' . $drawing->id,
                time() . '_' . $photoName,
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
}
