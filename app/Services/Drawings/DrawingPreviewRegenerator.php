<?php

namespace App\Services\Drawings;

use App\Models\Drawing;
use App\Models\DrawingChangeItem;
use App\Models\DrawingComparison;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Rebuilds a change's before/after animation from the drawings it came from.
 *
 * Previews are a cache, not a record. Everything needed to draw one again is
 * already stored — the region's coordinates on the item, the page size and both
 * revisions on the comparison — so a missing file is a rebuild rather than a
 * loss. That is what lets them be deleted aggressively: on dismissal, and on a
 * timer for anything nobody has ruled on.
 *
 * The rebuild is not cheap. It rasterizes both full pages to cut two small
 * crops out of them, which is most of a comparison run's per-sheet cost. That
 * is affordable here only because it happens for one change at a time, when
 * someone opens it, rather than for forty-five up front.
 */
class DrawingPreviewRegenerator
{
    /**
     * Where rasterized pages are parked between rebuilds.
     *
     * Rendering the two pages is 12 of the 17 seconds a rebuild takes, and it
     * is the same work for every change on the sheet. Reviewing a deck without
     * this means paying it per card; with it, only the first card pays.
     */
    private const PAGE_CACHE = 'drawing-page-cache';

    public function __construct(
        private readonly DrawingRegionCropper $cropper,
    ) {}

    /**
     * Return the item's preview path, rebuilding the file if it has been swept.
     *
     * Returns null when there is nothing to draw: a text change with no region,
     * a comparison missing its page size, or a rebuild that failed.
     */
    public function ensure(DrawingChangeItem $item): ?string
    {
        $disk = Storage::disk(DrawingRegionCropper::DISK);

        if ($item->preview_path !== null && $disk->exists($item->preview_path)) {
            return $item->preview_path;
        }

        if (! $this->isRebuildable($item)) {
            return null;
        }

        $path = $item->preview_path ?? $this->pathFor($item);

        // Two viewers opening the same change at once must not both rasterize
        // two full pages. The loser waits for the winner's file rather than
        // starting its own render.
        $lock = Cache::lock("drawing-preview-rebuild:{$item->id}", 120);

        try {
            if (! $lock->block(60)) {
                return $disk->exists($path) ? $path : null;
            }
        } catch (\Throwable) {
            return $disk->exists($path) ? $path : null;
        }

        try {
            // The winner may have finished while this request was blocked.
            if ($disk->exists($path)) {
                return $path;
            }

            return $this->rebuild($item, $path);
        } finally {
            optional($lock)->release();
        }
    }

    /**
     * Whether this change carries enough to be drawn again.
     *
     * Scalar columns only, and the caller may pass a comparison it already
     * holds — this is asked once per row when a comparison is serialised, and
     * walking to the relations here would be a query per change.
     */
    public function isRebuildable(DrawingChangeItem $item, ?DrawingComparison $comparison = null): bool
    {
        $comparison ??= $item->comparison;

        return $comparison !== null
            && $item->source === DrawingChangeItem::SOURCE_RASTER
            && (float) $item->w > 0
            && (float) $item->h > 0
            && (float) $comparison->page_width > 0
            && (float) $comparison->page_height > 0
            && $comparison->old_drawing_id !== null
            && $comparison->new_drawing_id !== null;
    }

    /**
     * Where an item's preview lives.
     *
     * Generation during a run names files by region index, because the rows do
     * not exist yet at that point. A rebuild has a row, so it uses the id — the
     * two never collide, and an item keeps whichever name it was first given.
     */
    private function pathFor(DrawingChangeItem $item): string
    {
        return "drawing-change-previews/{$item->drawing_comparison_id}/item-{$item->id}.gif";
    }

    private function rebuild(DrawingChangeItem $item, string $path): ?string
    {
        $comparison = $item->comparison;
        $oldCrop = null;
        $newCrop = null;

        try {
            // Checked here rather than in isRebuildable, which stays free of
            // queries: a drawing can be gone even when its id is still on the
            // row, and that is only discoverable by loading it.
            $oldDrawing = $comparison->oldDrawing;
            $newDrawing = $comparison->newDrawing;

            if ($oldDrawing === null || $newDrawing === null) {
                return null;
            }

            $oldPage = $this->page($oldDrawing);
            $newPage = $this->page($newDrawing);

            if ($oldPage === null || $newPage === null) {
                return null;
            }

            $region = [
                'x' => (float) $item->x,
                'y' => (float) $item->y,
                'w' => (float) $item->w,
                'h' => (float) $item->h,
            ];

            $pageWidth = (float) $comparison->page_width;
            $pageHeight = (float) $comparison->page_height;

            // The same amber marker the original carried, so a rebuilt preview
            // points at the same place the first one did.
            $marker = $this->cropper->markerRect($region, $pageWidth, $pageHeight);

            $oldCrop = $this->cropper->crop($oldPage, $region, $pageWidth, $pageHeight, $marker);
            $newCrop = $this->cropper->crop($newPage, $region, $pageWidth, $pageHeight, $marker);

            if ($oldCrop === null || $newCrop === null) {
                return null;
            }

            $written = $this->cropper->animate($oldCrop, $newCrop, $path);

            if ($written === null) {
                return null;
            }

            // Only recorded once the file is actually on disk, so a failed
            // rebuild never leaves a row pointing at nothing.
            if ($item->preview_path !== $written) {
                $item->forceFill(['preview_path' => $written])->saveQuietly();
            }

            return $written;
        } catch (\Throwable $e) {
            Log::warning('Could not rebuild change preview', [
                'item_id' => $item->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        } finally {
            foreach ([$oldCrop, $newCrop] as $crop) {
                if ($crop !== null && file_exists($crop)) {
                    @unlink($crop);
                }
            }
        }
    }

    /**
     * A rasterized page for this drawing, rendered only if it is not parked.
     *
     * Returns an absolute path. The file is deliberately not released after
     * use — it is left for the next change on the same sheet, and swept on a
     * shorter timer than the previews themselves.
     */
    private function page(Drawing $drawing): ?string
    {
        $disk = Storage::disk(DrawingRegionCropper::DISK);
        $relative = self::PAGE_CACHE."/{$drawing->id}.png";

        if ($disk->exists($relative)) {
            return $disk->path($relative);
        }

        $source = null;
        $rendered = null;

        try {
            $source = DrawingSourceFile::open($drawing);
            $rendered = $this->cropper->prepare($source->path);

            if ($rendered === null) {
                return null;
            }

            // Written through the disk first so the directory is created, then
            // copied over it — the render is several megabytes and reading it
            // into a string to hand to put() would be pointless.
            $disk->put($relative, '');
            $target = $disk->path($relative);

            if (! @copy($rendered, $target)) {
                $disk->delete($relative);

                return null;
            }

            return $target;
        } catch (\Throwable $e) {
            Log::warning('Could not render page for preview rebuild', [
                'drawing_id' => $drawing->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        } finally {
            // Always released: what is returned is the parked copy, never this.
            $this->cropper->release($rendered);
            $source?->close();
        }
    }

    /**
     * Drop an item's cached animation, keeping the row that can rebuild it.
     *
     * preview_path is deliberately left in place: it is where the preview
     * lives, not proof that it currently does.
     */
    public function forget(DrawingChangeItem $item): void
    {
        if ($item->preview_path === null) {
            return;
        }

        Storage::disk(DrawingRegionCropper::DISK)->delete($item->preview_path);
    }
}
