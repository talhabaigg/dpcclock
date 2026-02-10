<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Drawing;
use App\Models\Location;
use Illuminate\Http\Request;

class ProjectDrawingController extends Controller
{
    /**
     * SWCP and GRE company parent IDs (from Employment Hero).
     */
    private const ALLOWED_PARENT_IDS = [
        1249093, // SWCP
        1198645, // GRE (GREEN)
    ];

    /**
     * List projects (locations) that belong to SWCP or GRE companies.
     * Each project includes count of active drawings.
     */
    public function projects(Request $request)
    {
        $query = Location::whereIn('eh_parent_id', self::ALLOWED_PARENT_IDS)
            ->withCount(['drawings' => function ($q) {
                $q->where('status', Drawing::STATUS_ACTIVE);
            }])
            ->orderBy('name');

        $projects = $query->get()->map(function ($location) {
            return [
                'id' => $location->id,
                'name' => $location->name,
                'eh_location_id' => $location->eh_location_id,
                'eh_parent_id' => $location->eh_parent_id,
                'external_id' => $location->external_id,
                'state' => $location->state,
                'drawings_count' => $location->drawings_count,
            ];
        });

        return response()->json($projects);
    }

    /**
     * List all active drawings for a project.
     * Drawing includes all fields directly (sheet_number, title, discipline, storage_path, etc.)
     */
    public function index(Request $request, Location $project)
    {
        $query = Drawing::where('project_id', $project->id)
            ->where('status', Drawing::STATUS_ACTIVE)
            ->with(['observations.createdBy', 'createdBy', 'updatedBy'])
            ->orderBy('sheet_number');

        // Optional discipline filter
        if ($request->has('discipline')) {
            $query->where('discipline', $request->discipline);
        }

        $drawings = $query->get();

        return response()->json($drawings);
    }

    /**
     * Get a single drawing with full details.
     */
    public function show(Location $project, Drawing $drawing)
    {
        $drawing->load([
            'observations.createdBy',
            'observations.updatedBy',
            'previousRevision:id,title,revision_number',
            'createdBy',
            'updatedBy',
        ]);

        return response()->json($drawing);
    }
}
