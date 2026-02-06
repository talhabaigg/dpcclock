<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DrawingSheet;
use App\Models\Location;
use App\Models\QaStageDrawing;
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
     * Each project includes counts of drawing sheets and QA stages.
     */
    public function projects(Request $request)
    {
        $query = Location::whereIn('eh_parent_id', self::ALLOWED_PARENT_IDS)
            ->withCount(['drawingSheets', 'qaStages'])
            ->orderBy('name');

        $projects = $query->get()->map(function ($location) {
            return [
                'id' => $location->id,
                'name' => $location->name,
                'eh_location_id' => $location->eh_location_id,
                'eh_parent_id' => $location->eh_parent_id,
                'external_id' => $location->external_id,
                'state' => $location->state,
                'drawing_sheets_count' => $location->drawing_sheets_count,
                'qa_stages_count' => $location->qa_stages_count,
            ];
        });

        return response()->json($projects);
    }

    /**
     * List all drawings (current revisions) for a project.
     * Returns DrawingSheet records with their current QaStageDrawing revision loaded.
     */
    public function index(Request $request, Location $project)
    {
        $query = DrawingSheet::where('project_id', $project->id)
            ->whereNotNull('current_revision_id')
            ->with([
                'currentRevision' => function ($q) {
                    $q->with(['observations.createdBy', 'createdBy', 'updatedBy']);
                },
                'currentRevision.drawingSet:id,original_filename',
            ])
            ->orderBy('sheet_number');

        // Optional discipline filter
        if ($request->has('discipline')) {
            $query->where('discipline', $request->discipline);
        }

        $sheets = $query->get();

        // Return the current revision (QaStageDrawing) for each sheet,
        // enriched with sheet metadata, so mobile can treat them like drawings
        $drawings = $sheets->map(function ($sheet) {
            $revision = $sheet->currentRevision;
            if (! $revision) {
                return null;
            }

            // Merge sheet metadata onto the drawing for convenience
            $revision->setAttribute('sheet_number', $sheet->sheet_number);
            $revision->setAttribute('sheet_title', $sheet->title);
            $revision->setAttribute('sheet_discipline', $sheet->discipline);
            $revision->setAttribute('sheet_display_name', $sheet->display_name);
            $revision->setAttribute('revision_count', $sheet->revision_count);

            return $revision;
        })->filter()->values();

        return response()->json($drawings);
    }

    /**
     * Get a single drawing with full details.
     * Delegates to QaStageDrawing show logic.
     */
    public function show(Location $project, QaStageDrawing $drawing)
    {
        $drawing->load([
            'drawingSheet',
            'drawingSheet.revisions' => function ($query) {
                $query->select('id', 'drawing_sheet_id', 'revision_number', 'revision_date', 'status', 'created_at')
                    ->orderBy('created_at', 'desc');
            },
            'observations.createdBy',
            'observations.updatedBy',
            'previousRevision:id,name,revision_number',
            'createdBy',
            'updatedBy',
        ]);

        return response()->json($drawing);
    }
}
