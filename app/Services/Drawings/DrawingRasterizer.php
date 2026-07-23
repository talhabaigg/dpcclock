<?php

namespace App\Services\Drawings;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

/**
 * Renders a drawing PDF to raw 8-bit grayscale bytes.
 *
 * Raw gray rather than PNG on purpose: the diff needs per-pixel values, and
 * `file_get_contents` on a raw buffer gives exactly width * height bytes with
 * no decoding step. Pulling the same pixels back out of a PNG through GD costs
 * seconds per sheet for no benefit.
 *
 * Rendering happens at a higher density than the target and is then downsampled,
 * which anti-aliases hairlines into gray instead of dropping them — a wall drawn
 * at 0.13mm would vanish if rendered straight to the target size.
 */
class DrawingRasterizer
{
    /**
     * Render page one of a PDF to raw grayscale.
     *
     * @return array{data: string, width: int, height: int}|null
     */
    public function render(string $pdfPath, int $targetWidth, int $targetHeight, int $density = 100, ?float $erode = null): ?array
    {
        $binary = $this->findMagick();

        if ($binary === null) {
            Log::warning('ImageMagick not available; raster comparison unavailable');

            return null;
        }

        $output = tempnam(sys_get_temp_dir(), 'drawraster_');

        $command = [
            $binary,
            '-density', (string) $density,
            $pdfPath.'[0]',
            '-colorspace', 'gray',
            // Flatten transparency to white; without this an alpha channel
            // renders as black and the whole sheet reads as solid ink.
            '-alpha', 'remove',
            '-alpha', 'off',
        ];

        if ($erode !== null) {
            // Stroke-weight filter. Architectural drawings carry their meaning
            // in line weight: walls are drawn heavy, while dimensions, leaders,
            // hatching, tags and text are thin. Eroding a binary ink mask
            // destroys anything thinner than the structuring element and leaves
            // the heavy strokes standing, so what survives is essentially the
            // wall geometry alone.
            //
            // This must happen at full render resolution — erosion at the
            // downsampled size would eat the walls too — hence the resize after.
            array_push($command,
                '-threshold', '70%',
                // Erosion shrinks white; ink has to be white for the pass.
                '-negate',
                '-morphology', 'Erode', 'Disk:'.$erode,
                '-negate',
            );
        }

        array_push($command,
            // "!" forces the exact geometry, so the byte count is known and
            // both revisions land on identical grids.
            '-resize', "{$targetWidth}x{$targetHeight}!",
            '-depth', '8',
            'gray:'.$output,
        );

        try {
            $result = Process::timeout(300)->run($command);

            if (! $result->successful()) {
                Log::warning('PDF rasterization failed', [
                    'exit_code' => $result->exitCode(),
                    'error' => substr($result->errorOutput(), 0, 500),
                ]);

                return null;
            }

            $data = file_get_contents($output);
            $expected = $targetWidth * $targetHeight;

            if ($data === false || strlen($data) !== $expected) {
                Log::warning('Rasterized output was not the expected size', [
                    'expected' => $expected,
                    'actual' => $data === false ? 0 : strlen($data),
                ]);

                return null;
            }

            return ['data' => $data, 'width' => $targetWidth, 'height' => $targetHeight];
        } catch (\Throwable $e) {
            Log::warning('PDF rasterization threw', ['error' => $e->getMessage()]);

            return null;
        } finally {
            if (file_exists($output)) {
                @unlink($output);
            }
        }
    }

    /**
     * The PDF's page box in points, read from an already-local file.
     *
     * At 72 DPI one pixel is exactly one point, so the reported pixel geometry
     * is the point geometry — the same trick DrawingProcessingService uses, but
     * without re-downloading a file the caller already has.
     *
     * Returns the origin as well as the size, because a page box is not
     * required to start at (0, 0) and CAD exports routinely do not: an observed
     * A1 sheet carries [-1191.97 -841.89 1191.97 841.89], centred on the
     * origin. Anything comparing PDF user-space coordinates against the page
     * has to subtract that offset first or every position is out by half a
     * sheet.
     *
     * @return array{0: float, 1: float, 2: float, 3: float}|null [width, height, originX, originY]
     */
    public function probePageBox(string $pdfPath): ?array
    {
        $binary = $this->findMagick();

        if ($binary === null) {
            return null;
        }

        try {
            $isMagick7 = str_contains(strtolower(basename($binary)), 'magick');

            $command = $isMagick7
                ? [$binary, 'identify', '-density', '72', '-format', '%w %h', $pdfPath.'[0]']
                : [$binary, '-density', '72', '-format', '%w %h', $pdfPath.'[0]'];

            $result = Process::timeout(60)->run($command);

            if (! $result->successful()) {
                return null;
            }

            $parts = preg_split('/\s+/', trim($result->output()));

            if (! is_array($parts) || count($parts) < 2) {
                return null;
            }

            $width = (float) $parts[0];
            $height = (float) $parts[1];

            if ($width <= 0 || $height <= 0) {
                return null;
            }

            [$originX, $originY] = $this->pageOrigin($pdfPath);

            return [$width, $height, $originX, $originY];
        } catch (\Throwable $e) {
            Log::warning('Page box probe failed', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * Lower-left corner of the page box, in points.
     *
     * ImageMagick reports the page size but not where it starts, so the box is
     * read from the file. Falls back to (0, 0), which is the common case and a
     * safe assumption when the box cannot be parsed.
     *
     * @return array{0: float, 1: float}
     */
    private function pageOrigin(string $pdfPath): array
    {
        try {
            // The box appears in the first few KB of any normal PDF; reading
            // the whole file to find it would be wasteful on 4MB drawings.
            $handle = fopen($pdfPath, 'rb');

            if ($handle === false) {
                return [0.0, 0.0];
            }

            $head = fread($handle, 65536);
            fclose($handle);

            if ($head === false) {
                return [0.0, 0.0];
            }

            // CropBox wins where present — it is what both the renderer and
            // pdf.js actually lay out against.
            foreach (['CropBox', 'MediaBox'] as $key) {
                if (preg_match('/\/'.$key.'\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)/', $head, $m) === 1) {
                    return [(float) $m[1], (float) $m[2]];
                }
            }
        } catch (\Throwable $e) {
            // Fall through to the default.
        }

        return [0.0, 0.0];
    }

    public function isAvailable(): bool
    {
        return $this->findMagick() !== null;
    }

    /**
     * The resolved ImageMagick binary, for callers that build their own
     * commands (region cropping).
     */
    public function magickBinary(): ?string
    {
        return $this->findMagick();
    }

    /**
     * Locate the ImageMagick binary. `magick` is v7; `convert` is the v6 name.
     */
    private function findMagick(): ?string
    {
        static $resolved = false;
        static $path = null;

        if ($resolved) {
            return $path;
        }

        $resolved = true;

        $configured = config('drawings.comparison.magick_path');

        if ($configured && is_executable($configured)) {
            return $path = $configured;
        }

        foreach (['magick', 'convert'] as $candidate) {
            $probe = Process::timeout(15)->run([$candidate, '-version']);

            if ($probe->successful()) {
                return $path = $candidate;
            }
        }

        return $path = null;
    }
}
