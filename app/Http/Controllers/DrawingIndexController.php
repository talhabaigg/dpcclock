<?php

namespace App\Http\Controllers;

use App\Models\DrawingSheet;
use App\Models\Location;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DrawingIndexController extends Controller
{
    /**
     * Display a listing of all drawings (latest revisions) for a project.
     */
    public function index(Request $request, Location $project): Response
    {
        // Get all drawing sheets for this project with their current revision
        $drawingSheets = DrawingSheet::where('project_id', $project->id)
            ->whereNotNull('current_revision_id')
            ->with([
                'currentRevision:id,drawing_sheet_id,drawing_number,drawing_title,revision_number,revision,status,page_preview_s3_key,drawing_set_id,created_at',
                'currentRevision.drawingSet:id,original_filename',
            ])
            ->orderBy('sheet_number')
            ->get()
            ->map(function ($sheet) {
                $revision = $sheet->currentRevision;
                return [
                    'id' => $sheet->id,
                    'sheet_number' => $sheet->sheet_number,
                    'title' => $sheet->title,
                    'display_name' => $sheet->display_name,
                    'discipline' => $sheet->discipline,
                    'revision_count' => $sheet->revision_count,
                    'current_revision_id' => $sheet->current_revision_id,
                    'created_at' => $sheet->created_at,
                    'revision' => $revision ? [
                        'id' => $revision->id,
                        'drawing_number' => $revision->drawing_number,
                        'drawing_title' => $revision->drawing_title,
                        'revision_number' => $revision->revision_number ?? $revision->revision,
                        'status' => $revision->status,
                        'created_at' => $revision->created_at,
                        'drawing_set_name' => $revision->drawingSet?->original_filename,
                    ] : null,
                ];
            });

        return Inertia::render('projects/drawings/index', [
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
            ],
            'drawings' => $drawingSheets,
        ]);
    }
}
