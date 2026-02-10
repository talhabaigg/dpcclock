<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DrawingObservation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DrawingObservationController extends Controller
{
    public function index(Request $request)
    {
        $query = DrawingObservation::with(['drawing', 'createdBy', 'updatedBy']);

        if ($request->has('drawing_id')) {
            $query->where('drawing_id', $request->drawing_id);
        }

        $observations = $query->orderBy('created_at', 'desc')->get();

        return response()->json($observations);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'drawing_id' => 'required|exists:drawings,id',
            'type' => 'required|string|in:defect,observation',
            'description' => 'required|string|max:2000',
            'page_number' => 'required|integer|min:1',
            'x' => 'required|numeric|min:0|max:1',
            'y' => 'required|numeric|min:0|max:1',
            'photo' => 'nullable|file|mimetypes:image/*|max:51200',
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
                'drawing-observations/'.$validated['drawing_id'],
                time().'_'.$photoName,
                's3'
            );
        }

        try {
            $observation = DrawingObservation::create([
                'drawing_id' => $validated['drawing_id'],
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
                'drawing_id' => $validated['drawing_id'],
                'error' => $e->getMessage(),
            ]);

            if ($photoPath) {
                Storage::disk('s3')->delete($photoPath);
            }

            return response()->json(['message' => 'Failed to save observation.'], 500);
        }
    }

    public function show(DrawingObservation $drawingObservation)
    {
        $drawingObservation->load(['drawing.project', 'createdBy', 'updatedBy']);

        return response()->json($drawingObservation);
    }

    public function update(Request $request, DrawingObservation $drawingObservation)
    {
        $validated = $request->validate([
            'type' => 'sometimes|required|string|in:defect,observation',
            'description' => 'sometimes|required|string|max:2000',
            'page_number' => 'sometimes|required|integer|min:1',
            'x' => 'sometimes|required|numeric|min:0|max:1',
            'y' => 'sometimes|required|numeric|min:0|max:1',
            'photo' => 'nullable|file|mimetypes:image/*|max:51200',
            'remove_photo' => 'sometimes|boolean',
            'is_360_photo' => 'nullable|boolean',
        ]);

        $photoPath = $drawingObservation->photo_path;
        $photoName = $drawingObservation->photo_name;
        $photoType = $drawingObservation->photo_type;
        $photoSize = $drawingObservation->photo_size;

        if ($request->boolean('remove_photo')) {
            if ($drawingObservation->photo_path) {
                Storage::disk('s3')->delete($drawingObservation->photo_path);
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
                'drawing-observations/'.$drawingObservation->drawing_id,
                time().'_'.$photoName,
                's3'
            );

            if ($drawingObservation->photo_path) {
                Storage::disk('s3')->delete($drawingObservation->photo_path);
            }
        }

        try {
            $drawingObservation->update([
                'type' => $validated['type'] ?? $drawingObservation->type,
                'description' => $validated['description'] ?? $drawingObservation->description,
                'page_number' => $validated['page_number'] ?? $drawingObservation->page_number,
                'x' => $validated['x'] ?? $drawingObservation->x,
                'y' => $validated['y'] ?? $drawingObservation->y,
                'photo_path' => $photoPath,
                'photo_name' => $photoName,
                'photo_type' => $photoType,
                'photo_size' => $photoSize,
                'is_360_photo' => $request->has('is_360_photo')
                    ? $request->boolean('is_360_photo')
                    : $drawingObservation->is_360_photo,
            ]);

            $drawingObservation->load(['drawing', 'createdBy', 'updatedBy']);

            return response()->json($drawingObservation);
        } catch (\Exception $e) {
            Log::error('Observation update failed', [
                'observation_id' => $drawingObservation->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Failed to update observation.'], 500);
        }
    }

    public function photo(DrawingObservation $drawingObservation)
    {
        if (! $drawingObservation->photo_path) {
            return response()->json(['message' => 'No photo found.'], 404);
        }

        if (! Storage::disk('s3')->exists($drawingObservation->photo_path)) {
            return response()->json(['message' => 'Photo file not found.'], 404);
        }

        $stream = Storage::disk('s3')->readStream($drawingObservation->photo_path);

        return response()->stream(function () use ($stream) {
            fpassthru($stream);
        }, 200, [
            'Content-Type' => $drawingObservation->photo_type ?? 'image/jpeg',
            'Content-Disposition' => 'inline; filename="'.($drawingObservation->photo_name ?? 'photo.jpg').'"',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    public function destroy(DrawingObservation $drawingObservation)
    {
        if ($drawingObservation->photo_path) {
            Storage::disk('s3')->delete($drawingObservation->photo_path);
        }

        $drawingObservation->delete();

        return response()->json(['message' => 'Observation deleted successfully']);
    }
}
