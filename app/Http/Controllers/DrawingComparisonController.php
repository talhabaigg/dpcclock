<?php

namespace App\Http\Controllers;

use App\Jobs\AnalyzeDrawingRevisionChanges;
use App\Models\Drawing;
use App\Models\DrawingChangeItem;
use App\Models\DrawingComparison;
use App\Services\Drawings\DrawingComparisonService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Revision change detection for a pair of drawings.
 *
 * The plan viewer polls `show` while a comparison is running; `analyze` starts
 * one. Results are cached per revision pair, so repeat visits cost nothing.
 */
class DrawingComparisonController extends Controller
{
    public function __construct(private readonly DrawingComparisonService $service) {}

    /**
     * Cached result for a revision pair, or null when nothing has run yet.
     */
    public function show(Request $request, Drawing $drawing): JsonResponse
    {
        $old = $this->resolveOldDrawing($request, $drawing);

        if ($old === null) {
            return response()->json(['message' => 'Invalid comparison pair.'], 422);
        }

        $comparison = DrawingComparison::with('items')
            ->where('old_drawing_id', $old->id)
            ->where('new_drawing_id', $drawing->id)
            ->first();

        return response()->json([
            'comparison' => $comparison ? $this->format($comparison) : null,
        ]);
    }

    /**
     * Start (or return) an analysis for a revision pair.
     */
    public function analyze(Request $request, Drawing $drawing): JsonResponse
    {
        if (! config('drawings.comparison.enabled', true)) {
            return response()->json(['message' => 'Change detection is disabled.'], 403);
        }

        $old = $this->resolveOldDrawing($request, $drawing);

        if ($old === null) {
            return response()->json(['message' => 'Invalid comparison pair.'], 422);
        }

        $comparison = $this->service->findOrCreate($old, $drawing, $request->user()?->id);

        // Already answered — hand back the cache rather than re-queueing.
        if ($comparison->status !== DrawingComparison::STATUS_COMPLETE) {
            AnalyzeDrawingRevisionChanges::dispatch($comparison->id);
        }

        return response()->json([
            'comparison' => $this->format($comparison->load('items')),
        ]);
    }

    /**
     * Validate that the requested old revision is a real sibling drawing in the
     * same project. Prevents comparing across projects.
     */
    private function resolveOldDrawing(Request $request, Drawing $drawing): ?Drawing
    {
        $oldId = $request->integer('compare_old');

        if ($oldId <= 0 || $oldId === $drawing->id) {
            return null;
        }

        return Drawing::where('project_id', $drawing->project_id)
            ->whereKey($oldId)
            ->first();
    }

    /**
     * @return array<string, mixed>
     */
    private function format(DrawingComparison $comparison): array
    {
        $order = ['high' => 0, 'medium' => 1, 'low' => 2];

        $items = $comparison->items
            // Most significant first; un-ranked rows (interpretation skipped or
            // failed) sort last but are still shown.
            ->sortBy(fn (DrawingChangeItem $item) => $order[$item->significance] ?? 3)
            ->values()
            ->map(fn (DrawingChangeItem $item) => [
                'id' => $item->id,
                'source' => $item->source,
                'change_type' => $item->change_type,
                'text_old' => $item->text_old,
                'text_new' => $item->text_new,
                'count_old' => $item->count_old,
                'count_new' => $item->count_new,
                'element' => $item->element,
                'description' => $item->description,
                'trade_impact' => $item->trade_impact ?? [],
                'significance' => $item->significance,
                'confidence' => $item->confidence,
                'page_number' => $item->page_number,
                'locatable' => (bool) $item->locatable,
                'x' => $item->x,
                'y' => $item->y,
                'w' => $item->w,
                'h' => $item->h,
            ]);

        return [
            'id' => $comparison->id,
            'status' => $comparison->status,
            'error' => $comparison->error,
            'methods' => $comparison->methods ?? [],
            'coordinates_reliable' => (bool) $comparison->coordinates_reliable,
            'text_comparable' => (bool) $comparison->text_comparable,
            'summary' => $comparison->summary,
            'revision_notes' => $comparison->revision_notes ?? [],
            'changes_total' => $comparison->changes_total,
            'changes_high' => $comparison->changes_high,
            'analyzed_at' => $comparison->analyzed_at,
            'items' => $items,
        ];
    }
}
