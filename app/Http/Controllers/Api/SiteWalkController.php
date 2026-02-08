<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DrawingSheet;
use App\Models\Location;
use App\Models\SiteWalk;
use App\Models\SiteWalkPhoto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class SiteWalkController extends Controller
{
    /**
     * List site walks for a project.
     */
    public function index(Location $project)
    {
        $walks = SiteWalk::where('project_id', $project->id)
            ->orderBy('walk_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($walks);
    }

    /**
     * Create a new site walk.
     */
    public function store(Request $request, Location $project)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
            'walk_date' => 'required|date',
        ]);

        $walk = SiteWalk::create([
            'project_id' => $project->id,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'walk_date' => $validated['walk_date'],
            'status' => 'in_progress',
        ]);

        return response()->json($walk, 201);
    }

    /**
     * Get a single site walk with its photos.
     */
    public function show(SiteWalk $siteWalk)
    {
        $siteWalk->load(['photos.drawingSheet', 'createdBy']);

        return response()->json($siteWalk);
    }

    /**
     * Update a site walk.
     */
    public function update(Request $request, SiteWalk $siteWalk)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string|max:2000',
            'walk_date' => 'sometimes|date',
            'status' => 'sometimes|string|in:in_progress,completed,archived',
        ]);

        $siteWalk->update($validated);

        return response()->json($siteWalk);
    }

    /**
     * Soft delete a site walk.
     */
    public function destroy(SiteWalk $siteWalk)
    {
        $siteWalk->delete();

        return response()->json(null, 204);
    }

    /**
     * Get tour data — everything the viewer needs to render a virtual tour.
     */
    public function tour(SiteWalk $siteWalk)
    {
        $photos = $siteWalk->photos()
            ->with('drawingSheet')
            ->get();

        // Group photos by drawing sheet to build sheet info
        $sheetIds = $photos->pluck('drawing_sheet_id')->unique();
        $sheets = DrawingSheet::whereIn('id', $sheetIds)
            ->with('currentRevision')
            ->get()
            ->map(function ($sheet) use ($photos) {
                $sheetPhotos = $photos->where('drawing_sheet_id', $sheet->id);

                return [
                    'id' => $sheet->id,
                    'sheet_number' => $sheet->sheet_number,
                    'title' => $sheet->title,
                    'display_name' => $sheet->display_name,
                    'current_revision_id' => $sheet->current_revision_id,
                    'background_url' => $sheet->current_revision_id
                        ? '/api/qa-stage-drawings/'.$sheet->current_revision_id.'/file'
                        : null,
                    'photo_ids' => $sheetPhotos->pluck('id')->values(),
                ];
            });

        // Build photo data with scene IDs
        $photoData = $photos->map(function ($photo) {
            return [
                'id' => $photo->id,
                'scene_id' => 'photo_'.$photo->id,
                'site_walk_id' => $photo->site_walk_id,
                'drawing_sheet_id' => $photo->drawing_sheet_id,
                'page_number' => $photo->page_number,
                'x' => $photo->x,
                'y' => $photo->y,
                'heading' => $photo->heading,
                'sequence_order' => $photo->sequence_order,
                'caption' => $photo->caption,
                'photo_url' => '/api/site-walk-photos/'.$photo->id.'/file',
                'hotspot_overrides' => $photo->hotspot_overrides,
                'sheet_display_name' => $photo->drawingSheet?->display_name,
                'current_revision_id' => $photo->drawingSheet?->current_revision_id,
                'created_at' => $photo->created_at,
            ];
        });

        return response()->json([
            'walk' => $siteWalk->only(['id', 'name', 'description', 'walk_date', 'status', 'photo_count']),
            'photos' => $photoData,
            'sheets' => $sheets,
        ]);
    }

    /**
     * Upload a 360 photo to a site walk.
     */
    public function storePhoto(Request $request, SiteWalk $siteWalk)
    {
        $validated = $request->validate([
            'drawing_sheet_id' => 'required|exists:drawing_sheets,id',
            'page_number' => 'required|integer|min:1',
            'x' => 'required|numeric|min:0|max:1',
            'y' => 'required|numeric|min:0|max:1',
            'heading' => 'nullable|numeric',
            'sequence_order' => 'required|integer|min:1',
            'caption' => 'nullable|string|max:255',
            'photo' => 'required|file|mimetypes:image/*|max:51200', // 50MB max
        ]);

        $photo = $request->file('photo');
        $photoName = $photo->getClientOriginalName();
        $photoType = $photo->getClientMimeType();
        $photoSize = $photo->getSize();
        $photoPath = $photo->storeAs(
            'site-walk-photos/'.$siteWalk->id,
            time().'_'.$photoName,
            's3'
        );

        try {
            $siteWalkPhoto = SiteWalkPhoto::create([
                'site_walk_id' => $siteWalk->id,
                'drawing_sheet_id' => $validated['drawing_sheet_id'],
                'page_number' => $validated['page_number'],
                'x' => $validated['x'],
                'y' => $validated['y'],
                'heading' => $validated['heading'] ?? null,
                'sequence_order' => $validated['sequence_order'],
                'caption' => $validated['caption'] ?? null,
                'photo_path' => $photoPath,
                'photo_name' => $photoName,
                'photo_type' => $photoType,
                'photo_size' => $photoSize,
            ]);

            // Update denormalized photo count
            $siteWalk->update([
                'photo_count' => $siteWalk->photos()->count(),
            ]);

            $siteWalkPhoto->load('drawingSheet');

            return response()->json($siteWalkPhoto, 201);
        } catch (\Exception $e) {
            Log::error('Site walk photo upload failed', [
                'site_walk_id' => $siteWalk->id,
                'error' => $e->getMessage(),
            ]);

            if ($photoPath) {
                Storage::disk('s3')->delete($photoPath);
            }

            return response()->json(['message' => 'Failed to save photo.'], 500);
        }
    }

    /**
     * Update a site walk photo (caption, position).
     */
    public function updatePhoto(Request $request, SiteWalkPhoto $photo)
    {
        $validated = $request->validate([
            'caption' => 'nullable|string|max:255',
            'x' => 'sometimes|numeric|min:0|max:1',
            'y' => 'sometimes|numeric|min:0|max:1',
            'heading' => 'nullable|numeric',
            'sequence_order' => 'sometimes|integer|min:1',
            'hotspot_overrides' => 'nullable|array',
            'hotspot_overrides.*' => 'array',
            'hotspot_overrides.*.yaw' => 'required|numeric',
            'hotspot_overrides.*.pitch' => 'required|numeric',
        ]);

        $photo->update($validated);

        return response()->json($photo);
    }

    /**
     * Soft delete a site walk photo.
     */
    public function destroyPhoto(SiteWalkPhoto $photo)
    {
        $walkId = $photo->site_walk_id;
        $photo->delete();

        // Update denormalized photo count
        $walk = SiteWalk::find($walkId);
        if ($walk) {
            $walk->update(['photo_count' => $walk->photos()->count()]);
        }

        return response()->json(null, 204);
    }

    /**
     * Stream a site walk photo file from S3.
     */
    public function photoFile(SiteWalkPhoto $photo)
    {
        if (! $photo->photo_path) {
            return response()->json(['message' => 'No photo found.'], 404);
        }

        if (! Storage::disk('s3')->exists($photo->photo_path)) {
            return response()->json(['message' => 'Photo file not found.'], 404);
        }

        $stream = Storage::disk('s3')->readStream($photo->photo_path);

        return response()->stream(function () use ($stream) {
            fpassthru($stream);
        }, 200, [
            'Content-Type' => $photo->photo_type ?? 'image/jpeg',
            'Content-Disposition' => 'inline; filename="'.($photo->photo_name ?? 'photo.jpg').'"',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }
}
