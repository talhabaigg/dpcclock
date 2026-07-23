<?php

namespace App\Services\Drawings;

use App\Models\Drawing;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * A drawing's source PDF as a local file path.
 *
 * Media normally lives on S3, and both the text extractor and the rasterizer
 * need a real path on disk. This owns the download-and-clean-up so neither has
 * to, and so a temp copy is never left behind.
 */
final class DrawingSourceFile
{
    private function __construct(
        public readonly string $path,
        private readonly bool $temporary,
    ) {}

    /**
     * Resolve a drawing's source PDF, downloading it if it lives remotely.
     * Returns null when there is no source, or it is not a PDF.
     */
    public static function open(Drawing $drawing): ?self
    {
        $media = $drawing->getFirstMedia('source');

        if (! $media) {
            return null;
        }

        $extension = strtolower(pathinfo($media->file_name, PATHINFO_EXTENSION));
        $isPdf = $extension === 'pdf' || str_contains(strtolower($media->mime_type ?? ''), 'pdf');

        if (! $isPdf) {
            return null;
        }

        if ($media->disk !== 's3') {
            $path = $media->getPath();

            return file_exists($path) ? new self($path, false) : null;
        }

        try {
            $contents = Storage::disk($media->disk)->get($media->getPathRelativeToRoot());

            if (! $contents) {
                return null;
            }

            $temp = sys_get_temp_dir().'/drawing_src_'.md5((string) $media->id).'_'.uniqid().'.pdf';
            file_put_contents($temp, $contents);

            return new self($temp, true);
        } catch (\Throwable $e) {
            Log::warning('Failed to download drawing source', [
                'drawing_id' => $drawing->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Discard the scratch copy. A file that was already local is left alone.
     */
    public function close(): void
    {
        if ($this->temporary && file_exists($this->path)) {
            @unlink($this->path);
        }
    }
}
