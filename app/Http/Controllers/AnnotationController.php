<?php

namespace App\Http\Controllers;

use App\Models\Annotation;
use App\Models\Drawing;
use App\Models\Location;
use App\Support\Annotations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * CRUD for viewer annotations. Routes are drawing-scoped for list/create (the
 * only annotatable so far) and generic for update/delete. When other
 * annotatables arrive (photos, documents), add their scoped list/create routes
 * with their own permission middleware; update/destroy stay shared.
 */
class AnnotationController extends Controller
{
    public function index(Drawing $drawing): JsonResponse
    {
        $annotations = $drawing->annotations()
            ->with('linkTarget:id,sheet_number,title,revision_number')
            ->orderBy('id')
            ->get([
                'id', 'page_number', 'kind', 'color', 'filled',
                'geometry', 'link_drawing_id', 'text', 'font_size', 'stroke_width',
                'created_by', 'created_at', 'updated_at',
            ]);

        return response()->json([
            'annotations' => $annotations->map(fn (Annotation $a) => $this->format($a)),
        ]);
    }

    /**
     * Lean list of a project's active plans for the hyperlink target picker —
     * no media/appends, unlike the mobile-oriented API drawings index.
     */
    public function linkTargets(Location $project): JsonResponse
    {
        return response()->json([
            'targets' => Drawing::where('project_id', $project->id)
                ->where('status', Drawing::STATUS_ACTIVE)
                ->orderBy('sheet_number')
                ->get(['id', 'sheet_number', 'title', 'revision_number'])
                ->map(fn (Drawing $d) => [
                    'id' => $d->id,
                    'sheet_number' => $d->sheet_number,
                    'title' => $d->title,
                    'revision_number' => $d->revision_number,
                ]),
        ]);
    }

    public function store(Request $request, Drawing $drawing): JsonResponse
    {
        $validated = $request->validate(Annotations::rules());

        $annotation = $drawing->annotations()->create($validated);

        return response()->json(['annotation' => $this->format($annotation)], 201);
    }

    public function update(Request $request, Annotation $annotation): JsonResponse
    {
        $validated = $request->validate(Annotations::rules(partial: true));

        $annotation->update($validated);

        return response()->json(['annotation' => $this->format($annotation->fresh())]);
    }

    /**
     * Plain-array shape. The link target is flattened by hand because the
     * Drawing model appends presigned media URLs on serialization — far too
     * heavy to compute per link row.
     */
    private function format(Annotation $a): array
    {
        $target = $a->kind === 'link' ? $a->linkTarget : null;

        return [
            'id' => $a->id,
            'page_number' => $a->page_number,
            'kind' => $a->kind,
            'color' => $a->color,
            'filled' => $a->filled,
            'geometry' => $a->geometry,
            'link_drawing_id' => $a->link_drawing_id,
            'link_target' => $target ? [
                'id' => $target->id,
                'sheet_number' => $target->sheet_number,
                'title' => $target->title,
                'revision_number' => $target->revision_number,
            ] : null,
            'text' => $a->text,
            'font_size' => $a->font_size,
            'stroke_width' => $a->stroke_width,
            'created_by' => $a->created_by,
            'created_at' => $a->created_at,
            'updated_at' => $a->updated_at,
        ];
    }

    public function destroy(Annotation $annotation): JsonResponse
    {
        $annotation->delete();

        return response()->json(['ok' => true]);
    }
}
