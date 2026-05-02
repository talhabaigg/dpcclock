<?php

namespace App\Support;

/**
 * Measurement geometry math.
 *
 * Inputs:
 *  - $points: array of normalized [0,1] vertices, each a shape:
 *      ['x' => float, 'y' => float,
 *       'hix' => float|null, 'hiy' => float|null,   // optional bezier handle in (delta from x,y)
 *       'hox' => float|null, 'hoy' => float|null]   // optional bezier handle out (delta from x,y)
 *  - $ppu: pixels per real-world unit (from DrawingScaleCalibration)
 *  - $imgW / $imgH: source pixel dimensions of the drawing (Drawing::tiles_width/height)
 *
 * Vertices with handles cause the segments touching them to be cubic Beziers
 * rather than straight chords. Length/area calculations tessellate any such
 * segments before integrating.
 *
 * The W and H must match what was used at calibration time, otherwise the
 * scale is off for non-square drawings.
 */
class MeasurementGeometry
{
    private const SAMPLES_PER_BEZIER = 24;

    public static function polylineLength(array $points, float $ppu, int $imgW, int $imgH): float
    {
        $flat = self::tessellateBeziers($points);
        $total = 0.0;
        for ($i = 1; $i < count($flat); $i++) {
            $dx = ($flat[$i]['x'] - $flat[$i - 1]['x']) * $imgW;
            $dy = ($flat[$i]['y'] - $flat[$i - 1]['y']) * $imgH;
            $total += sqrt($dx * $dx + $dy * $dy);
        }

        return round($total / $ppu, 4);
    }

    public static function polygonArea(array $points, float $ppu, int $imgW, int $imgH): float
    {
        $flat = self::tessellateBeziers($points, true);
        $n = count($flat);
        $area = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $j = ($i + 1) % $n;
            $xi = $flat[$i]['x'] * $imgW;
            $yi = $flat[$i]['y'] * $imgH;
            $xj = $flat[$j]['x'] * $imgW;
            $yj = $flat[$j]['y'] * $imgH;
            $area += ($xi * $yj) - ($xj * $yi);
        }
        $pixelArea = abs($area) / 2;

        return round($pixelArea / ($ppu * $ppu), 4);
    }

    public static function polygonPerimeter(array $points, float $ppu, int $imgW, int $imgH): float
    {
        $flat = self::tessellateBeziers($points, true);
        $n = count($flat);
        $total = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $j = ($i + 1) % $n;
            $dx = ($flat[$j]['x'] - $flat[$i]['x']) * $imgW;
            $dy = ($flat[$j]['y'] - $flat[$i]['y']) * $imgH;
            $total += sqrt($dx * $dx + $dy * $dy);
        }

        return round($total / $ppu, 4);
    }

    /**
     * Tessellate any bezier segments into short chords. Segments where
     * neither endpoint carries a handle pass through unchanged. When $closed
     * is true, the segment from the last vertex back to the first is also
     * tessellated.
     */
    private static function tessellateBeziers(array $points, bool $closed = false): array
    {
        $n = count($points);
        if ($n < 2) {
            return $points;
        }

        $out = [['x' => $points[0]['x'], 'y' => $points[0]['y']]];
        $last = $closed ? $n : $n - 1;
        for ($i = 0; $i < $last; $i++) {
            $a = $points[$i];
            $b = $points[($i + 1) % $n];
            $aHas = isset($a['hox']) || isset($a['hoy']);
            $bHas = isset($b['hix']) || isset($b['hiy']);
            if (! $aHas && ! $bHas) {
                if (! $closed || $i < $last - 1) {
                    $out[] = ['x' => $b['x'], 'y' => $b['y']];
                }
                continue;
            }

            $aHx = $a['x'] + ($a['hox'] ?? 0);
            $aHy = $a['y'] + ($a['hoy'] ?? 0);
            $bHx = $b['x'] + ($b['hix'] ?? 0);
            $bHy = $b['y'] + ($b['hiy'] ?? 0);

            $samples = self::SAMPLES_PER_BEZIER;
            for ($s = 1; $s <= $samples; $s++) {
                $t = $s / $samples;
                if ($closed && $i === $last - 1 && $s === $samples) {
                    // Closing segment's last sample equals points[0] — skip to
                    // avoid duplicating the start point in a closed polygon.
                    break;
                }
                $u = 1 - $t;
                $u2 = $u * $u;
                $u3 = $u2 * $u;
                $t2 = $t * $t;
                $t3 = $t2 * $t;
                $out[] = [
                    'x' => $u3 * $a['x'] + 3 * $u2 * $t * $aHx + 3 * $u * $t2 * $bHx + $t3 * $b['x'],
                    'y' => $u3 * $a['y'] + 3 * $u2 * $t * $aHy + 3 * $u * $t2 * $bHy + $t3 * $b['y'],
                ];
            }
        }

        return $out;
    }
}
