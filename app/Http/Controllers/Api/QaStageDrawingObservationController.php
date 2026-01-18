<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\QaStageDrawing;
use App\Models\QaStageDrawingObservation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

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
            'photo' => 'nullable', // Loosened to allow base64/data URIs
        ]);

        $photo = $this->processPhoto($request, (int) $validated['qa_stage_drawing_id']);
        $photoPath = $photo['path'];
        $photoName = $photo['name'];
        $photoType = $photo['type'];
        $photoSize = $photo['size'];

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
            'photo' => 'nullable', // Loosened to allow base64/data URIs
        ]);

        $photo = $this->processPhoto($request, $qaStageDrawingObservation->qa_stage_drawing_id, $qaStageDrawingObservation);
        $photoPath = $photo['path'];
        $photoName = $photo['name'];
        $photoType = $photo['type'];
        $photoSize = $photo['size'];

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

    private function processPhoto(Request $request, int $drawingId, ?QaStageDrawingObservation $existing = null): array
    {
        $photoPath = $existing?->photo_path;
        $photoName = $existing?->photo_name;
        $photoType = $existing?->photo_type;
        $photoSize = $existing?->photo_size;

        if ($request->hasFile('photo')) {
            $photo = $request->file('photo');
            $photoName = $photo->getClientOriginalName();
            $photoType = $photo->getClientMimeType();
            $photoSize = $photo->getSize();
            $photoPath = $photo->storeAs(
                'qa-drawing-observations/' . $drawingId,
                time() . '_' . $photoName,
                'public'
            );

            if ($existing?->photo_path) {
                Storage::disk('public')->delete($existing->photo_path);
            }
        } elseif ($request->filled('photo')) {
            $payload = $request->input('photo');
            if (is_string($payload) && Str::startsWith($payload, 'data:image/')) {
                [$meta, $base64] = explode(',', $payload, 2);
                $mime = explode(';', str_replace('data:', '', $meta))[0] ?: 'image/jpeg';
                $extension = explode('/', $mime)[1] ?? 'jpg';
                $binary = base64_decode($base64);
                if ($binary !== false) {
                    $photoName = 'photo_' . time() . '.' . $extension;
                    $photoType = $mime;
                    $photoSize = strlen($binary);
                    $photoPath = 'qa-drawing-observations/' . $drawingId . '/' . $photoName;
                    Storage::disk('public')->put($photoPath, $binary);

                    if ($existing?->photo_path) {
                        Storage::disk('public')->delete($existing->photo_path);
                    }
                }
            }
        }

        return [
            'path' => $photoPath,
            'name' => $photoName,
            'type' => $photoType,
            'size' => $photoSize,
        ];
    }
}
