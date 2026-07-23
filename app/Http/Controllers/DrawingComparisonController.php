<?php

namespace App\Http\Controllers;

use App\Jobs\AnalyzeDrawingRevisionChanges;
use App\Models\Annotation;
use App\Models\Drawing;
use App\Models\DrawingChangeItem;
use App\Models\DrawingComparison;
use App\Services\Drawings\DrawingComparisonService;
use App\Services\Drawings\DrawingRegionCropper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

        // `force` discards a cached result and analyses again. Normally the
        // cache is the point — a revision pair never changes — but it also
        // means detection improvements never reach a pair someone has already
        // opened, and there is no way to retry a run that came back poor.
        $force = $request->boolean('force');

        $comparison = $this->service->findOrCreate($old, $drawing, $request->user()?->id, $force);

        // Already answered — hand back the cache rather than re-queueing.
        if ($comparison->status !== DrawingComparison::STATUS_COMPLETE) {
            AnalyzeDrawingRevisionChanges::dispatch($comparison->id);
        }

        return response()->json([
            'comparison' => $this->format($comparison->load('items')),
        ]);
    }

    /**
     * Stream a change's before/after animation.
     *
     * Served through the app rather than from a public disk because drawings
     * are project-restricted; the route sits behind the same drawings.view
     * permission as everything else here.
     */
    public function preview(Request $request, Drawing $drawing, DrawingChangeItem $item): StreamedResponse|JsonResponse
    {
        $comparison = $item->comparison;

        // The item must genuinely belong to a comparison ending at this
        // drawing, or the drawing in the URL means nothing for authorisation.
        if ($comparison === null || $comparison->new_drawing_id !== $drawing->id || ! $item->preview_path) {
            return response()->json(['message' => 'Preview not found.'], 404);
        }

        $disk = Storage::disk(DrawingRegionCropper::DISK);

        if (! $disk->exists($item->preview_path)) {
            return response()->json(['message' => 'Preview not found.'], 404);
        }

        return $disk->response($item->preview_path, null, [
            'Content-Type' => 'image/gif',
            // Immutable: a comparison's previews are regenerated under a fresh
            // path when it is re-run, so a cached one is never stale.
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }

    /**
     * Draw revision clouds on the new sheet for the detected changes.
     *
     * This is the point of the whole pipeline for anyone who works off paper:
     * a clouded drawing is the format the trades already read. It reuses the
     * existing annotation layer rather than inventing a parallel one, so the
     * clouds pan, zoom, print and delete exactly like hand-drawn markup.
     *
     * Only locatable changes can be clouded — a change whose coordinates are
     * not real page positions would put a cloud somewhere arbitrary, which is
     * worse than no cloud.
     */
    public function cloud(Request $request, Drawing $drawing): JsonResponse
    {
        $validated = $request->validate([
            'compare_old' => ['required', 'integer'],
            // Default to the changes that affect what gets built; a full-sheet
            // cloud of every drafting tweak is noise on paper too.
            'significance' => ['sometimes', 'array'],
            'significance.*' => ['string', 'in:high,medium,low'],
        ]);

        $old = $this->resolveOldDrawing($request, $drawing);

        if ($old === null) {
            return response()->json(['message' => 'Invalid comparison pair.'], 422);
        }

        $comparison = DrawingComparison::with('items')
            ->where('old_drawing_id', $old->id)
            ->where('new_drawing_id', $drawing->id)
            ->where('status', DrawingComparison::STATUS_COMPLETE)
            ->first();

        if ($comparison === null) {
            return response()->json(['message' => 'No completed comparison to cloud.'], 422);
        }

        $pageWidth = (float) $comparison->page_width;
        $pageHeight = (float) $comparison->page_height;

        if ($pageWidth <= 0 || $pageHeight <= 0) {
            return response()->json([
                'message' => 'This comparison predates page-size capture. Re-run the analysis to enable clouding.',
            ], 422);
        }

        $wanted = $validated['significance'] ?? ['high', 'medium'];

        $targets = $comparison->items
            ->filter(fn (DrawingChangeItem $item) => $item->hasLocation()
                && in_array($item->significance, $wanted, true)
                && $item->w > 0 && $item->h > 0);

        if ($targets->isEmpty()) {
            return response()->json(['message' => 'No locatable changes matched.', 'created' => 0]);
        }

        $created = 0;

        // Clouding the same comparison twice should not stack duplicates on
        // top of each other, which is the obvious way to use this button.
        // Existing cloud geometry on this sheet is the cheapest identity we
        // have, and it survives the user having deleted some by hand.
        $existing = Annotation::query()
            ->where('annotatable_type', $drawing->getMorphClass())
            ->where('annotatable_id', $drawing->id)
            ->where('kind', 'cloud')
            ->pluck('geometry')
            ->map(fn ($geometry) => $this->geometryKey(is_array($geometry) ? $geometry : []))
            ->filter()
            ->flip();

        DB::transaction(function () use ($targets, $drawing, $pageWidth, $pageHeight, $existing, &$created) {
            foreach ($targets as $item) {
                $geometry = $this->normalisedBox($item, $pageWidth, $pageHeight);

                if ($geometry === null || $existing->has($this->geometryKey($geometry))) {
                    continue;
                }

                Annotation::create([
                    'annotatable_type' => $drawing->getMorphClass(),
                    'annotatable_id' => $drawing->id,
                    'page_number' => $item->page_number ?: 1,
                    'kind' => 'cloud',
                    // Revision clouds are red by drafting convention.
                    'color' => '#DC2626',
                    'filled' => false,
                    'geometry' => $geometry,
                    'stroke_width' => 2,
                ]);

                $created++;
            }
        });

        return response()->json([
            'message' => match (true) {
                $created === 0 => 'These changes are already clouded.',
                $created === 1 => '1 change clouded.',
                default => "{$created} changes clouded.",
            },
            'created' => $created,
        ]);
    }

    /**
     * Rounded geometry signature, used only to recognise a cloud this action
     * already drew. Rounded because a float round-trip through JSON should not
     * make an identical box look new.
     *
     * @param  array<string, mixed>  $geometry
     */
    private function geometryKey(array $geometry): ?string
    {
        if (! isset($geometry['x'], $geometry['y'], $geometry['w'], $geometry['h'])) {
            return null;
        }

        return implode(':', array_map(
            fn ($value) => number_format((float) $value, 4, '.', ''),
            [$geometry['x'], $geometry['y'], $geometry['w'], $geometry['h']],
        ));
    }

    /**
     * Convert a change's PDF-point box into the annotation layer's normalised
     * 0-1 space.
     *
     * Two conversions happen here: PDF y runs from the bottom, the viewer's
     * world runs from the top; and a little margin is added so the cloud sits
     * around the change rather than clipping through it.
     *
     * @return array<string, float>|null
     */
    private function normalisedBox(DrawingChangeItem $item, float $pageWidth, float $pageHeight): ?array
    {
        $margin = 0.15;
        $w = $item->w * (1 + $margin * 2);
        $h = $item->h * (1 + $margin * 2);
        $x = $item->x - $item->w * $margin;
        $y = $item->y - $item->h * $margin;

        $nx = $x / $pageWidth;
        $nw = $w / $pageWidth;
        // Flip to a top-down origin, taking the box's top edge.
        $ny = 1 - ($y + $h) / $pageHeight;
        $nh = $h / $pageHeight;

        // Clamp into the sheet. A cloud partly off-page is fine; one entirely
        // off-page means the coordinates were wrong and it should be skipped.
        $nx = max(0.0, min($nx, 1.0));
        $ny = max(0.0, min($ny, 1.0));
        $nw = min($nw, 1 - $nx);
        $nh = min($nh, 1 - $ny);

        if ($nw <= 0.001 || $nh <= 0.001) {
            return null;
        }

        return ['x' => round($nx, 6), 'y' => round($ny, 6), 'w' => round($nw, 6), 'h' => round($nh, 6)];
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
                'preview_url' => $item->preview_path
                    ? route('drawings.comparison.preview', ['drawing' => $comparison->new_drawing_id, 'item' => $item->id])
                    : null,
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
