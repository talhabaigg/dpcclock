<?php

namespace App\Console\Commands;

use App\Models\DrawingComparison;
use App\Services\Drawings\DrawingRegionCropper;
use Illuminate\Console\Command;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;

/**
 * Keeps the before/after animation cache from growing without bound.
 *
 * Two sweeps, for two different kinds of dead file.
 *
 * Orphans: DrawingComparison deletes its own directory on the way out, which
 * covers anything removed through Eloquent. It does not cover a drawing deleted
 * at the database level — the foreign key cascades the comparison rows away
 * without firing model events, so the files survive their owner with nothing
 * left pointing at them.
 *
 * Cold previews: everything still owned but untouched for a day. These are not
 * lost, only dropped — the change keeps the coordinates and revisions it was
 * cut from, so opening it draws the animation again.
 */
class PruneDrawingChangePreviews extends Command
{
    protected $signature = 'drawings:prune-change-previews
        {--dry-run : List what would be removed without deleting}
        {--stale-hours=24 : Also drop cached previews older than this many hours}
        {--page-cache-hours=2 : Drop rasterized page renders older than this many hours}';

    protected $description = 'Delete revision-comparison previews that are orphaned or gone cold';

    public function handle(): int
    {
        $disk = Storage::disk(DrawingRegionCropper::DISK);
        $root = 'drawing-change-previews';

        if (! $disk->exists($root)) {
            $this->info('No previews stored.');

            return self::SUCCESS;
        }

        $this->pruneStale($disk, $root, (int) $this->option('stale-hours'), 'cached preview');

        // Page renders are the scaffolding a rebuild is cut from, not the
        // output. They are far larger than the previews — several megabytes a
        // sheet — and only useful for as long as someone is working through a
        // deck, so they go much sooner.
        $this->pruneStale($disk, 'drawing-page-cache', (int) $this->option('page-cache-hours'), 'page render');

        $onDisk = collect($disk->directories($root))->map(fn (string $path) => basename($path));
        $live = DrawingComparison::pluck('id')->map(fn ($id) => (string) $id);
        $orphans = $onDisk->diff($live);

        if ($orphans->isEmpty()) {
            $this->info('No orphaned preview sets.');

            return self::SUCCESS;
        }

        $bytes = 0;

        foreach ($orphans as $id) {
            foreach ($disk->allFiles("{$root}/{$id}") as $file) {
                $bytes += $disk->size($file);
            }

            if (! $this->option('dry-run')) {
                $disk->deleteDirectory("{$root}/{$id}");
            }
        }

        $this->info(sprintf(
            '%s %d orphaned preview set(s), %.1f MB.',
            $this->option('dry-run') ? 'Would remove' : 'Removed',
            $orphans->count(),
            $bytes / 1048576,
        ));

        return self::SUCCESS;
    }

    /**
     * Drop cached animations nobody has opened in a while.
     *
     * A preview is only ever a cache — the item keeps the coordinates and the
     * revisions it was cut from, so opening the change draws it again. The one
     * copy that is a record, the attachment on a raised task, has already been
     * written to the task's own media and is not touched here.
     *
     * Accepted changes are swept along with undecided ones for that reason.
     * Rebuilding costs seconds and only happens if someone reopens the change;
     * keeping every animation forever costs several megabytes per comparison
     * for a set that is opened about one percent of the time.
     */
    private function pruneStale(Filesystem $disk, string $root, int $hours, string $label): void
    {
        if ($hours <= 0 || ! $disk->exists($root)) {
            return;
        }

        // Judged on the file's own age, not the row's. A preview rebuilt today
        // for a change detected last month is in active use; keying off the
        // item's timestamps would sweep it on the next run and rebuild it on
        // the next view, forever.
        $cutoff = now()->subHours($hours)->getTimestamp();
        $removed = 0;
        $bytes = 0;

        foreach ($disk->allFiles($root) as $file) {
            if ($disk->lastModified($file) >= $cutoff) {
                continue;
            }

            $bytes += $disk->size($file);
            $removed++;

            if (! $this->option('dry-run')) {
                $disk->delete($file);
            }
        }

        if ($removed === 0) {
            return;
        }

        $this->info(sprintf(
            '%s %d %s(s) older than %dh, %.1f MB.',
            $this->option('dry-run') ? 'Would remove' : 'Removed',
            $removed,
            $label,
            $hours,
            $bytes / 1048576,
        ));
    }
}
