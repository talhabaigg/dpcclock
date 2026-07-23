<?php

namespace App\Console\Commands;

use App\Models\DrawingComparison;
use App\Services\Drawings\DrawingRegionCropper;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Removes before/after animations belonging to comparisons that no longer exist.
 *
 * DrawingComparison deletes its own directory on the way out, which covers
 * anything removed through Eloquent. It does not cover a drawing deleted at the
 * database level: the foreign key cascades the comparison rows away without
 * firing model events, so the files survive their owner with nothing left
 * pointing at them.
 */
class PruneDrawingChangePreviews extends Command
{
    protected $signature = 'drawings:prune-change-previews {--dry-run : List what would be removed without deleting}';

    protected $description = 'Delete revision-comparison previews whose comparison no longer exists';

    public function handle(): int
    {
        $disk = Storage::disk(DrawingRegionCropper::DISK);
        $root = 'drawing-change-previews';

        if (! $disk->exists($root)) {
            $this->info('No previews stored.');

            return self::SUCCESS;
        }

        $onDisk = collect($disk->directories($root))->map(fn (string $path) => basename($path));
        $live = DrawingComparison::pluck('id')->map(fn ($id) => (string) $id);
        $orphans = $onDisk->diff($live);

        if ($orphans->isEmpty()) {
            $this->info('Nothing to prune.');

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
}
