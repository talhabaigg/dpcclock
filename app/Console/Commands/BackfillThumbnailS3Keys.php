<?php

namespace App\Console\Commands;

use App\Models\Drawing;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class BackfillThumbnailS3Keys extends Command
{
    protected $signature = 'drawings:backfill-thumbnails';

    protected $description = 'Backfill thumbnail_s3_key for drawings that have page_preview_s3_key but no thumbnail_s3_key';

    public function handle(): int
    {
        $drawings = Drawing::whereNotNull('page_preview_s3_key')
            ->whereNull('thumbnail_s3_key')
            ->get();

        $this->info("Found {$drawings->count()} drawings to check.");

        $updated = 0;
        $missing = 0;

        foreach ($drawings as $drawing) {
            // Derive thumbnail key from preview key
            // Preview:   drawing-previews/{project_id}/{set_id}/page_0001.png
            // Thumbnail: drawing-thumbnails/{project_id}/{set_id}/thumb_0001.jpg
            $previewKey = $drawing->page_preview_s3_key;
            $thumbnailKey = str_replace('drawing-previews/', 'drawing-thumbnails/', $previewKey);
            $thumbnailKey = preg_replace('/page_(\d+)\.png$/', 'thumb_$1.jpg', $thumbnailKey);

            if (Storage::disk('s3')->exists($thumbnailKey)) {
                $drawing->update(['thumbnail_s3_key' => $thumbnailKey]);
                $updated++;
                $this->line("  Updated: #{$drawing->id} -> {$thumbnailKey}");
            } else {
                $missing++;
                $this->warn("  Missing in S3: {$thumbnailKey} (drawing #{$drawing->id})");
            }
        }

        $this->info("Done. Updated: {$updated}, Missing from S3: {$missing}");

        return self::SUCCESS;
    }
}
