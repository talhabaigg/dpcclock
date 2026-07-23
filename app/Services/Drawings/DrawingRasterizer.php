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
    public function render(string $pdfPath, int $targetWidth, int $targetHeight, int $density = 100): ?array
    {
        $binary = $this->findMagick();

        if ($binary === null) {
            Log::warning('ImageMagick not available; raster comparison unavailable');

            return null;
        }

        $output = tempnam(sys_get_temp_dir(), 'drawraster_');

        try {
            $result = Process::timeout(120)->run([
                $binary,
                '-density', (string) $density,
                $pdfPath.'[0]',
                '-colorspace', 'gray',
                // Flatten transparency to white; without this an alpha channel
                // renders as black and the whole sheet reads as solid ink.
                '-alpha', 'remove',
                '-alpha', 'off',
                // "!" forces the exact geometry, so the byte count is known and
                // both revisions land on identical grids.
                '-resize', "{$targetWidth}x{$targetHeight}!",
                '-depth', '8',
                'gray:'.$output,
            ]);

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
     * @return array{0: float, 1: float}|null
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

            return $width > 0 && $height > 0 ? [$width, $height] : null;
        } catch (\Throwable $e) {
            Log::warning('Page box probe failed', ['error' => $e->getMessage()]);

            return null;
        }
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
