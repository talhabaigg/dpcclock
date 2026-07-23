<?php

namespace App\Services\Drawings;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

/**
 * Cuts detected change regions out of a revision as PNG crops.
 *
 * These crops are the whole reason the raster pass produces bounding boxes
 * rather than a verdict: a vision model handed two dense A1 sheets and asked
 * what changed invents answers, but handed a 500px crop of one wall junction —
 * before on the left, after on the right — it is doing something it is
 * genuinely good at.
 *
 * The sheet is rendered once per revision and every crop is cut from that
 * raster. Rendering per region instead means re-rasterizing a full A1 page at
 * crop density for each one and discarding all but a few hundred pixels; at 25
 * regions across two revisions that was fifty full-page renders and it
 * dominated the entire analysis.
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

    /** Longest edge of the generated preview, in pixels. */
    private const PREVIEW_WIDTH = 460;

    /**
     * Interpolated frames inserted between the two states.
     *
     * A hard two-frame cut makes the eye hunt for what moved. Blending through
     * intermediates lets it track the thing that shifts. This is a dissolve,
     * not motion tracking — ImageMagick interpolates pixels, it does not follow
     * a wall from one position to another — but it reads far better than a
     * flash. Kept low because frame count drives file size directly.
     */
    private const MORPH_FRAMES = 3;

    /** Disk previews are written to. Private — drawings are not public. */
    public const DISK = 'local';

    public function __construct(private readonly DrawingRasterizer $rasterizer) {}

    /**
     * Rasterize a sheet once, ready for repeated cropping. The caller must pass
     * the returned path to release() when finished.
     */
    public function prepare(string $pdfPath): ?string
    {
        $binary = $this->rasterizer->magickBinary();

        if ($binary === null) {
            return null;
        }

        $output = tempnam(sys_get_temp_dir(), 'drawpage_').'.png';

        try {
            $result = Process::timeout(300)->run([
                $binary,
                '-density', (string) self::DENSITY,
                $pdfPath.'[0]',
                '-alpha', 'remove',
                '-alpha', 'off',
                $output,
            ]);

            if (! $result->successful() || ! file_exists($output) || filesize($output) === 0) {
                Log::warning('Page render for cropping failed', [
                    'exit_code' => $result->exitCode(),
                    'error' => substr($result->errorOutput(), 0, 300),
                ]);
                @unlink($output);

                return null;
            }

            return $output;
        } catch (\Throwable $e) {
            Log::warning('Page render for cropping threw', ['error' => $e->getMessage()]);
            @unlink($output);

            return null;
        }
    }

    public function release(?string $preparedPath): void
    {
        if ($preparedPath !== null && file_exists($preparedPath)) {
            @unlink($preparedPath);
        }
    }

    /**
     * Cut one region out of an already-rendered sheet.
     *
     * @param  array{x: float, y: float, w: float, h: float}  $region  in PDF points
     * @return string|null path to a temporary PNG, or null if it could not be cut
     */
    public function crop(string $preparedPath, array $region, float $pageWidth, float $pageHeight, ?array $marker = null): ?string
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
            $command = [
                $binary,
                $preparedPath,
                '-crop', "{$cropW}x{$cropH}+{$cropX}+{$cropY}",
                // The crop leaves the original canvas geometry attached, which
                // some encoders then honour by re-padding the image back to
                // full sheet size. Resetting the page discards it.
                '+repage',
            ];

            if ($marker !== null) {
                array_push($command, ...$this->markerDraw($marker));
            }

            $command[] = $output;

            $result = Process::timeout(120)->run($command);

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
     * Build an animated before/after GIF for one region.
     *
     * Flicking between two states in place is how people actually read a
     * drawing revision — the eye catches the thing that moves instantly, where
     * reading a written description of the same change takes real effort. The
     * two frames are labelled so a paused animation is still unambiguous.
     *
     * The changed region is outlined inside the frame. The crop is padded well
     * beyond the region so the change has context, which means for a small
     * change the animation shows a far wider area than actually moved — without
     * a marker the viewer is left hunting, and the box drawn on the sheet looks
     * like it points somewhere else entirely.
     *
     * @param  array{0: float, 1: float, 2: float, 3: float}|null  $marker  region rect within the crop, in crop pixels
     * @return string|null path relative to the storage disk, or null on failure
     */
    public function animate(string $oldCrop, string $newCrop, string $relativePath): ?string
    {
        $binary = $this->rasterizer->magickBinary();

        if ($binary === null) {
            return null;
        }

        $absolute = Storage::disk(self::DISK)->path($relativePath);
        $directory = dirname($absolute);

        if (! is_dir($directory)) {
            mkdir($directory, 0775, true);
        }

        try {
            // Each frame is built on its own, then the two are combined. Doing
            // it in one pipeline requires a per-frame label, and the obvious
            // way to express that (an fx ternary) does not work — fx yields
            // numbers, not strings. Three cheap calls are worth the certainty.
            $frames = [];

            foreach ([[$oldCrop, 'BEFORE'], [$newCrop, 'AFTER']] as [$source, $label]) {
                $frame = tempnam(sys_get_temp_dir(), 'drawframe_').'.png';
                $frames[] = $frame;

                $command = [
                    $binary,
                    $source,
                ];

                array_push($command,
                    // Both frames are pinned to one exact canvas. A GIF whose
                    // frames differ even by a pixel renders as a jitter, and on
                    // a before/after animation that jitter reads as a change
                    // that is not there — measured 496px against 494px at +0+2
                    // when the frames were built together.
                    '-resize', self::PREVIEW_WIDTH.'x'.self::PREVIEW_WIDTH.'>',
                    '-background', 'white', '-alpha', 'remove',
                    '-gravity', 'center', '-extent', self::PREVIEW_WIDTH.'x'.self::PREVIEW_WIDTH,
                    // Label bar, so a paused animation still says which
                    // revision is on screen.
                    '-gravity', 'North', '-splice', '0x20',
                    '-pointsize', '15', '-fill', 'black',
                    '-annotate', '+0+3', $label,
                    $frame,
                );

                $built = Process::timeout(60)->run($command);

                if (! $built->successful() || ! file_exists($frame) || filesize($frame) === 0) {
                    Log::warning('Region preview frame failed', [
                        'label' => $label,
                        'error' => substr($built->errorOutput(), 0, 300),
                    ]);

                    foreach ($frames as $f) {
                        @unlink($f);
                    }

                    return null;
                }
            }

            // Each end frame is repeated so the morph produces a hold there —
            // interpolating between two identical images yields identical
            // frames — then the sequence is mirrored so it eases back rather
            // than snapping to the start.
            $result = Process::timeout(120)->run([
                $binary,
                $frames[0], $frames[0], $frames[1], $frames[1],
                '-morph', (string) self::MORPH_FRAMES,
                '(', '-clone', '-2-1', ')',
                '-set', 'delay', '6',
                '-loop', '0',
                '-colors', '48',
                '-layers', 'OptimizeFrame',
                $absolute,
            ]);

            foreach ($frames as $frame) {
                @unlink($frame);
            }

            if (! $result->successful() || ! file_exists($absolute) || filesize($absolute) === 0) {
                Log::warning('Region preview animation failed', [
                    'exit_code' => $result->exitCode(),
                    'error' => substr($result->errorOutput(), 0, 300),
                ]);

                return null;
            }

            return $relativePath;
        } catch (\Throwable $e) {
            Log::warning('Region preview animation threw', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * Amber marker draw operations: a wide soft pass under a crisp one.
     *
     * Amber rather than red because drawings already use red for revision
     * clouds and the drafter's own markup, so a red box reads as part of the
     * drawing. The glow lifts it off dense line work without hiding what sits
     * beneath.
     *
     * @param  array{0: float, 1: float, 2: float, 3: float}  $marker
     * @return list<string>
     */
    private function markerDraw(array $marker): array
    {
        $rect = sprintf('rectangle %.0f,%.0f %.0f,%.0f', ...$marker);

        return [
            '-fill', 'none',
            '-stroke', 'rgba(245,158,11,0.28)', '-strokewidth', '11', '-draw', $rect,
            '-stroke', 'rgba(245,158,11,0.45)', '-strokewidth', '6', '-draw', $rect,
            '-stroke', '#F59E0B', '-strokewidth', '2.5', '-draw', $rect,
            '-stroke', 'none',
        ];
    }

    /**
     * Where the region sits inside its own crop, in crop pixels.
     *
     * @param  array{x: float, y: float, w: float, h: float}  $region
     * @return array{0: float, 1: float, 2: float, 3: float}
     */
    public function markerRect(array $region, float $pageWidth, float $pageHeight): array
    {
        [$x, $y, $w, $h] = $this->paddedBox($region, $pageWidth, $pageHeight);
        $scale = self::DENSITY / 72;

        // Crop pixels run top-down; the region's top edge is its y plus height
        // measured from the page bottom.
        $left = ($region['x'] - $x) * $scale;
        $top = (($y + $h) - ($region['y'] + $region['h'])) * $scale;

        return [
            $left,
            $top,
            $left + $region['w'] * $scale,
            $top + $region['h'] * $scale,
        ];
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
