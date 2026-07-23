<?php

namespace App\Services\Drawings;

/**
 * Finds regions of the sheet whose drawn content changed between revisions.
 *
 * This is the half of change detection the text layer cannot do: a wall that
 * moved, a door that disappeared, a ceiling grid that was re-laid all change
 * geometry without changing a single string.
 *
 * The pipeline is deliberately arithmetic, not AI. It answers "where did the
 * ink change", which is a question pixels can answer exactly; naming what
 * changed is left to a later vision pass over the crops these regions define.
 *
 * Three things make it usable rather than noisy:
 *
 *  1. Registration. Sheets get re-plotted a few pixels off. Without cancelling
 *     that offset first, every line on the page reads as changed. Column and
 *     row ink profiles are cross-correlated to recover the shift — drawings
 *     have strong axis-aligned structure (borders, grids, text baselines), so
 *     the two axes solve independently and cheaply. Verified to recover a known
 *     synthetic offset exactly.
 *  2. Cell aggregation rather than per-pixel comparison. Comparing ink *density*
 *     over a small cell absorbs sub-cell jitter that a per-pixel diff would
 *     report, and turns the whole job into one linear pass.
 *  3. Speck filtering and merging. Antialiasing produces single-cell hits, and
 *     one edited detail fragments into several components; neither is a change
 *     a person would describe separately.
 */
class DrawingRasterDiffService
{
    /**
     * Width in pixels the sheet is normalised to before comparison.
     *
     * Sized against what has to be visible, not against speed. At 1400px an A1
     * sheet renders at 0.6mm per pixel, so a partition line is thinner than a
     * pixel and a 100mm wall relocation moves it 1.7px — inside a single cell,
     * which is why real wall changes were being missed entirely. At 2800px the
     * same move is 3.3px and clears the threshold. The extra cost is about half
     * a second of arithmetic.
     */
    private const RASTER_WIDTH = 2800;

    /** Cell edge in pixels. At A1/2800px this is roughly 2.4mm on the sheet. */
    private const CELL = 8;

    /** Luminance below which a pixel counts as ink (0-255). */
    private const INK_THRESHOLD = 200;

    /** Largest re-plot offset searched for, in pixels. */
    private const MAX_SHIFT = 24;

    /** Minimum absolute ink-pixel change before a cell is considered changed. */
    private const MIN_DELTA = 4;

    /** Minimum change as a fraction of the cell's ink, so dense hatching is stable. */
    private const RATIO = 0.22;

    /** Components smaller than this are antialiasing artefacts, not changes. */
    private const MIN_CELLS = 3;

    /** Boxes closer than this (px) describe one change and are merged. */
    private const MERGE_GAP = 14;

    /**
     * Largest edge, in pixels, a merged region is allowed to reach.
     *
     * Without this, merging runs away on a heavily revised sheet: 88 components
     * fused into 11 regions each covering a large part of the drawing. A region
     * that big is useless downstream — cropping it hands the vision model a
     * zoomed-out view where nothing is legible, which is exactly why its
     * descriptions came back vague. A merge that would exceed this is refused,
     * so regions stay at a size a person (or a model) can actually read.
     */
    private const MAX_REGION_EDGE = 420;

    /**
     * Erosion radius, in pixels at WALL_DENSITY, used to isolate heavy strokes.
     *
     * Architectural drawings encode meaning in line weight: walls are drawn
     * heavy while dimensions, leaders, hatching, tags and text are thin.
     * Eroding a binary ink mask by this much destroys everything thinner and
     * leaves wall geometry standing. At 300 DPI one pixel is 0.085mm, so this
     * removes strokes under about 0.76mm.
     *
     * Chosen by sweeping 2.5 to 6.5 and looking at what survived on a tower
     * setout sheet. Below 4.5, thin linework and text ghosts persist and the
     * region count stays inflated (137 at 2.5, 101 at 3.5). Above it the walls
     * themselves start breaking into dashes, which both loses real partitions
     * and manufactures differences where two revisions happen to fragment
     * differently - the region count rises again at 5.5 despite less ink
     * surviving. At 4.5 partitions stay continuous, everything else is gone,
     * and the count bottoms out at 46.
     */
    private const WALL_ERODE = 4.5;

    /** Render density the erosion is performed at, in DPI. */
    private const WALL_DENSITY = 300;

    /**
     * Wall geometry is sparse compared with a full-ink sheet, so a change of a
     * few pixels in a cell is already meaningful and the relative floor has to
     * come down or genuine wall moves fall under it.
     */
    private const WALL_MIN_DELTA = 3;

    private const WALL_RATIO = 0.12;

    public function __construct(private readonly DrawingRasterizer $rasterizer) {}

    public function isAvailable(): bool
    {
        return $this->rasterizer->isAvailable();
    }

    /**
     * Compare two sheets and return changed regions in PDF points.
     *
     * @param  float  $pageWidth  page box width in points
     * @param  float  $pageHeight  page box height in points
     * @return array{regions: list<array{x: float, y: float, w: float, h: float, cells: int}>, offset: array{0: int, 1: int}}|null
     */
    public function diff(string $oldPdfPath, string $newPdfPath, float $pageWidth, float $pageHeight, bool $wallsOnly = false): ?array
    {
        if ($pageWidth <= 0 || $pageHeight <= 0) {
            return null;
        }

        $width = self::RASTER_WIDTH;
        $height = (int) max(1, round($width * ($pageHeight / $pageWidth)));

        $density = $wallsOnly ? self::WALL_DENSITY : 100;
        $erode = $wallsOnly ? self::WALL_ERODE : null;

        $old = $this->rasterizer->render($oldPdfPath, $width, $height, $density, $erode);
        $new = $this->rasterizer->render($newPdfPath, $width, $height, $density, $erode);

        if ($old === null || $new === null) {
            return null;
        }

        $oldInk = $this->inkMap($old['data'], $width * $height);
        $newInk = $this->inkMap($new['data'], $width * $height);

        [$dx, $dy] = $this->register($oldInk, $newInk, $width, $height);

        $regions = $this->regions($oldInk, $newInk, $width, $height, $dx, $dy, $wallsOnly);

        // Raster space maps linearly onto the real page box, so unlike the text
        // layer these coordinates are always true page positions.
        $scaleX = $pageWidth / $width;
        $scaleY = $pageHeight / $height;

        $out = [];
        foreach ($regions as $region) {
            $x0 = $region['x0'] * $scaleX;
            $x1 = $region['x1'] * $scaleX;
            // Raster y runs top-down; PDF y runs bottom-up.
            $y0 = $pageHeight - $region['y1'] * $scaleY;
            $y1 = $pageHeight - $region['y0'] * $scaleY;

            $out[] = [
                'x' => round($x0, 2),
                'y' => round($y0, 2),
                'w' => round($x1 - $x0, 2),
                'h' => round($y1 - $y0, 2),
                'cells' => $region['cells'],
            ];
        }

        return ['regions' => $out, 'offset' => [$dx, $dy]];
    }

    /**
     * Binary ink map, one byte per pixel. A packed string rather than an array —
     * an array of ints for a 1.4M-pixel sheet costs well over 100MB.
     */
    private function inkMap(string $raw, int $count): string
    {
        $out = str_repeat("\0", $count);

        for ($i = 0; $i < $count; $i++) {
            if (ord($raw[$i]) < self::INK_THRESHOLD) {
                $out[$i] = "\1";
            }
        }

        return $out;
    }

    /**
     * Recover the translation between the two sheets.
     *
     * @return array{0: int, 1: int}
     */
    private function register(string $oldInk, string $newInk, int $width, int $height): array
    {
        [$oldCols, $oldRows] = $this->profiles($oldInk, $width, $height);
        [$newCols, $newRows] = $this->profiles($newInk, $width, $height);

        return [
            $this->bestShift($oldCols, $newCols),
            $this->bestShift($oldRows, $newRows),
        ];
    }

    /**
     * Per-column and per-row ink counts.
     *
     * @return array{0: list<int>, 1: list<int>}
     */
    private function profiles(string $ink, int $width, int $height): array
    {
        $cols = array_fill(0, $width, 0);
        $rows = array_fill(0, $height, 0);

        for ($y = 0; $y < $height; $y++) {
            $base = $y * $width;
            $rowCount = 0;

            for ($x = 0; $x < $width; $x++) {
                if ($ink[$base + $x] === "\1") {
                    $cols[$x]++;
                    $rowCount++;
                }
            }

            $rows[$y] = $rowCount;
        }

        return [$cols, $rows];
    }

    /**
     * Shift that best aligns two 1D profiles, by lowest mean absolute
     * difference over the overlapping span.
     *
     * @param  list<int>  $a
     * @param  list<int>  $b
     */
    private function bestShift(array $a, array $b): int
    {
        $n = count($a);
        $best = 0;
        $bestScore = null;

        for ($shift = -self::MAX_SHIFT; $shift <= self::MAX_SHIFT; $shift++) {
            $sum = 0;
            $count = 0;

            for ($i = 0; $i < $n; $i++) {
                $j = $i + $shift;

                if ($j < 0 || $j >= $n) {
                    continue;
                }

                $sum += abs($a[$i] - $b[$j]);
                $count++;
            }

            if ($count === 0) {
                continue;
            }

            $score = $sum / $count;

            if ($bestScore === null || $score < $bestScore) {
                $bestScore = $score;
                $best = $shift;
            }
        }

        return $best;
    }

    /**
     * Changed regions, as boxes in raster pixels.
     *
     * @return list<array{cells: int, x0: int, y0: int, x1: int, y1: int}>
     */
    private function regions(string $oldInk, string $newInk, int $width, int $height, int $dx, int $dy, bool $wallsOnly = false): array
    {
        $minDelta = $wallsOnly ? self::WALL_MIN_DELTA : self::MIN_DELTA;
        $ratio = $wallsOnly ? self::WALL_RATIO : self::RATIO;

        $cellsWide = (int) ceil($width / self::CELL);
        $cellsHigh = (int) ceil($height / self::CELL);
        $total = $cellsWide * $cellsHigh;

        $oldCount = array_fill(0, $total, 0);
        $newCount = array_fill(0, $total, 0);

        // Single pass. The old sheet is sampled through the registration offset
        // so both grids describe the same physical area of the drawing.
        for ($y = 0; $y < $height; $y++) {
            $cellY = intdiv($y, self::CELL);
            $rowBase = $y * $width;
            $oldY = $y - $dy;
            $oldRowBase = $oldY * $width;
            $oldRowValid = $oldY >= 0 && $oldY < $height;

            for ($x = 0; $x < $width; $x++) {
                $cell = $cellY * $cellsWide + intdiv($x, self::CELL);

                if ($newInk[$rowBase + $x] === "\1") {
                    $newCount[$cell]++;
                }

                if ($oldRowValid) {
                    $oldX = $x - $dx;

                    if ($oldX >= 0 && $oldX < $width && $oldInk[$oldRowBase + $oldX] === "\1") {
                        $oldCount[$cell]++;
                    }
                }
            }
        }

        $changed = array_fill(0, $total, false);

        for ($cell = 0; $cell < $total; $cell++) {
            $delta = abs($newCount[$cell] - $oldCount[$cell]);
            $peak = max($newCount[$cell], $oldCount[$cell]);

            if ($delta >= $minDelta && $delta >= $ratio * $peak) {
                $changed[$cell] = true;
            }
        }

        $components = $this->connectedComponents($changed, $cellsWide, $cellsHigh);

        $components = array_values(array_filter(
            $components,
            fn (array $c) => $c['cells'] >= self::MIN_CELLS,
        ));

        return $this->splitOversized($this->mergeNearby($components));
    }

    /**
     * Break regions larger than the readable cap into a grid of tiles.
     *
     * Refusing to merge past the cap is not enough on its own: a single
     * contiguous change — a whole new detail block dropped onto a blank part of
     * the sheet — arrives as one component already larger than the cap. Cropping
     * it whole produces an image too zoomed-out to read, so it is tiled into
     * pieces that each fit. The change is not lost, it is just reported at a
     * scale someone can actually look at.
     *
     * @param  list<array{cells: int, x0: int, y0: int, x1: int, y1: int}>  $components
     * @return list<array{cells: int, x0: int, y0: int, x1: int, y1: int}>
     */
    private function splitOversized(array $components): array
    {
        $out = [];

        foreach ($components as $component) {
            $width = $component['x1'] - $component['x0'];
            $height = $component['y1'] - $component['y0'];

            if ($width <= self::MAX_REGION_EDGE && $height <= self::MAX_REGION_EDGE) {
                $out[] = $component;

                continue;
            }

            $cols = (int) ceil($width / self::MAX_REGION_EDGE);
            $rows = (int) ceil($height / self::MAX_REGION_EDGE);
            $tileWidth = (int) ceil($width / $cols);
            $tileHeight = (int) ceil($height / $rows);

            // Cells are spread evenly across the tiles rather than recounted;
            // the count is only ever used for ordering, and re-running the
            // flood fill per tile would cost more than the precision is worth.
            $share = max(1, (int) round($component['cells'] / max(1, $cols * $rows)));

            for ($row = 0; $row < $rows; $row++) {
                for ($col = 0; $col < $cols; $col++) {
                    $out[] = [
                        'cells' => $share,
                        'x0' => $component['x0'] + $col * $tileWidth,
                        'y0' => $component['y0'] + $row * $tileHeight,
                        'x1' => min($component['x1'], $component['x0'] + ($col + 1) * $tileWidth),
                        'y1' => min($component['y1'], $component['y0'] + ($row + 1) * $tileHeight),
                    ];
                }
            }
        }

        usort($out, fn (array $a, array $b) => $b['cells'] <=> $a['cells']);

        return array_values($out);
    }

    /**
     * 8-connected components over the changed cells. Iterative flood fill — a
     * large contiguous change would otherwise recurse thousands deep.
     *
     * @param  list<bool>  $changed
     * @return list<array{cells: int, x0: int, y0: int, x1: int, y1: int}>
     */
    private function connectedComponents(array $changed, int $cellsWide, int $cellsHigh): array
    {
        $total = $cellsWide * $cellsHigh;
        $seen = array_fill(0, $total, false);
        $components = [];

        for ($start = 0; $start < $total; $start++) {
            if (! $changed[$start] || $seen[$start]) {
                continue;
            }

            $stack = [$start];
            $seen[$start] = true;
            $minX = $maxX = $start % $cellsWide;
            $minY = $maxY = intdiv($start, $cellsWide);
            $count = 0;

            while ($stack) {
                $cell = array_pop($stack);
                $count++;

                $cx = $cell % $cellsWide;
                $cy = intdiv($cell, $cellsWide);

                $minX = min($minX, $cx);
                $maxX = max($maxX, $cx);
                $minY = min($minY, $cy);
                $maxY = max($maxY, $cy);

                for ($ny = $cy - 1; $ny <= $cy + 1; $ny++) {
                    for ($nx = $cx - 1; $nx <= $cx + 1; $nx++) {
                        if ($nx < 0 || $ny < 0 || $nx >= $cellsWide || $ny >= $cellsHigh) {
                            continue;
                        }

                        $neighbour = $ny * $cellsWide + $nx;

                        if ($changed[$neighbour] && ! $seen[$neighbour]) {
                            $seen[$neighbour] = true;
                            $stack[] = $neighbour;
                        }
                    }
                }
            }

            $components[] = [
                'cells' => $count,
                'x0' => $minX * self::CELL,
                'y0' => $minY * self::CELL,
                'x1' => ($maxX + 1) * self::CELL,
                'y1' => ($maxY + 1) * self::CELL,
            ];
        }

        return $components;
    }

    /**
     * Fuse boxes that sit within MERGE_GAP of one another. A single edited
     * detail typically fragments — a dimension, its witness lines and its
     * arrowheads land as separate components but are one change to a reader.
     *
     * @param  list<array{cells: int, x0: int, y0: int, x1: int, y1: int}>  $components
     * @return list<array{cells: int, x0: int, y0: int, x1: int, y1: int}>
     */
    private function mergeNearby(array $components): array
    {
        $merged = true;

        while ($merged) {
            $merged = false;

            for ($i = 0; $i < count($components) && ! $merged; $i++) {
                for ($j = $i + 1; $j < count($components); $j++) {
                    $a = $components[$i];
                    $b = $components[$j];

                    $gapX = max(0, max($a['x0'], $b['x0']) - min($a['x1'], $b['x1']));
                    $gapY = max(0, max($a['y0'], $b['y0']) - min($a['y1'], $b['y1']));

                    if ($gapX > self::MERGE_GAP || $gapY > self::MERGE_GAP) {
                        continue;
                    }

                    // Refuse a merge that would produce an unreadable region.
                    $mergedWidth = max($a['x1'], $b['x1']) - min($a['x0'], $b['x0']);
                    $mergedHeight = max($a['y1'], $b['y1']) - min($a['y0'], $b['y0']);

                    if ($mergedWidth > self::MAX_REGION_EDGE || $mergedHeight > self::MAX_REGION_EDGE) {
                        continue;
                    }

                    $components[$i] = [
                        'cells' => $a['cells'] + $b['cells'],
                        'x0' => min($a['x0'], $b['x0']),
                        'y0' => min($a['y0'], $b['y0']),
                        'x1' => max($a['x1'], $b['x1']),
                        'y1' => max($a['y1'], $b['y1']),
                    ];

                    array_splice($components, $j, 1);
                    $merged = true;
                    break;
                }
            }
        }

        usort($components, fn (array $a, array $b) => $b['cells'] <=> $a['cells']);

        return array_values($components);
    }
}
