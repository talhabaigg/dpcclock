<?php

namespace App\Services\Drawings;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

/**
 * Cuts a detected change region out of both revisions as a pair of PNGs.
 *
 * These crops are the whole reason the raster pass produces bounding boxes
 * rather than a verdict: a vision model handed two dense A1 sheets and asked
 * what changed invents answers, but handed a 500px crop of one wall junction —
 * before on the left, after on the right — it is doing something it is
 * genuinely good at.
 *
 * Crops are rendered at a much higher density than the detection pass. Finding
 * a region only needs enough resolution to see that ink moved; reading it needs
 * enough to make out a partition tag.
 */
class DrawingRegionCropper
{
    /** Render density for crops, in DPI. */
    private const DENSITY = 220;

    /**
     * Fraction of the region's size added around it as context. A change shown
     * hard against the crop edge is unreadable — the model needs to see what
     * the changed line work connects to.
     */
    private const PADDING = 0.35;

    /** Smallest crop edge in points, so a tiny region still lands legibly. */
    private const MIN_EDGE = 120.0;

    public function __construct(private readonly DrawingRasterizer $rasterizer) {}

    /**
     * Render one region from a PDF to a PNG on disk.
     *
     * @param  array{x: float, y: float, w: float, h: float}  $region  in PDF points
     * @return string|null path to a temporary PNG, or null if it could not be rendered
     */
    public function crop(string $pdfPath, array $region, float $pageWidth, float $pageHeight): ?string
    {
        $binary = $this->rasterizer->magickBinary();

        if ($binary === null || $pageWidth <= 0 || $pageHeight <= 0) {
            return null;
        }

        [$x, $y, $w, $h] = $this->paddedBox($region, $pageWidth, $pageHeight);

        $scale = self::DENSITY / 72;

        // PDF y is measured from the bottom; the raster crop origin is the top.
        $cropX = (int) round($x * $scale);
        $cropY = (int) round(($pageHeight - $y - $h) * $scale);
        $cropW = max(1, (int) round($w * $scale));
        $cropH = max(1, (int) round($h * $scale));

        $output = tempnam(sys_get_temp_dir(), 'drawcrop_').'.png';

        try {
            $result = Process::timeout(120)->run([
                $binary,
                '-density', (string) self::DENSITY,
                $pdfPath.'[0]',
                '-alpha', 'remove',
                '-alpha', 'off',
                '-crop', "{$cropW}x{$cropH}+{$cropX}+{$cropY}",
                // The crop leaves the original canvas geometry attached, which
                // some encoders then honour by re-padding the image back to
                // full sheet size. Resetting the page discards it.
                '+repage',
                $output,
            ]);

            if (! $result->successful() || ! file_exists($output) || filesize($output) === 0) {
                Log::warning('Region crop failed', [
                    'exit_code' => $result->exitCode(),
                    'error' => substr($result->errorOutput(), 0, 300),
                ]);

                @unlink($output);

                return null;
            }

            return $output;
        } catch (\Throwable $e) {
            Log::warning('Region crop threw', ['error' => $e->getMessage()]);
            @unlink($output);

            return null;
        }
    }

    /**
     * Expand a region for context and clamp it inside the page.
     *
     * @param  array{x: float, y: float, w: float, h: float}  $region
     * @return array{0: float, 1: float, 2: float, 3: float}
     */
    private function paddedBox(array $region, float $pageWidth, float $pageHeight): array
    {
        $w = max($region['w'], self::MIN_EDGE);
        $h = max($region['h'], self::MIN_EDGE);

        // Grow around the region's centre so the change stays centred even
        // after the minimum-size bump.
        $centreX = $region['x'] + $region['w'] / 2;
        $centreY = $region['y'] + $region['h'] / 2;

        $w *= (1 + self::PADDING * 2);
        $h *= (1 + self::PADDING * 2);

        $x = $centreX - $w / 2;
        $y = $centreY - $h / 2;

        // Clamp to the sheet; ImageMagick would silently truncate a crop that
        // runs off the canvas, shifting what the model is looking at.
        $w = min($w, $pageWidth);
        $h = min($h, $pageHeight);
        $x = max(0.0, min($x, $pageWidth - $w));
        $y = max(0.0, min($y, $pageHeight - $h));

        return [$x, $y, $w, $h];
    }
}
