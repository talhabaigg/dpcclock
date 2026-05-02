<?php

namespace App\Support;

/**
 * Measurement geometry math.
 *
 * Inputs:
 *  - $points: array of ['x' => float, 'y' => float] in normalized [0,1] space
 *  - $ppu: pixels per real-world unit (from DrawingScaleCalibration)
 *  - $imgW / $imgH: source pixel dimensions of the drawing (Drawing::tiles_width/height)
 *
 * The W and H must match what was used at calibration time, otherwise the
 * scale is off for non-square drawings.
 */
class MeasurementGeometry
{
    public static function polylineLength(array $points, float $ppu, int $imgW, int $imgH): float
    {
        $total = 0.0;
        for ($i = 1; $i < count($points); $i++) {
            $dx = ($points[$i]['x'] - $points[$i - 1]['x']) * $imgW;
            $dy = ($points[$i]['y'] - $points[$i - 1]['y']) * $imgH;
            $total += sqrt($dx * $dx + $dy * $dy);
        }

        return round($total / $ppu, 4);
    }

    public static function polygonArea(array $points, float $ppu, int $imgW, int $imgH): float
    {
        $n = count($points);
        $area = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $j = ($i + 1) % $n;
            $xi = $points[$i]['x'] * $imgW;
            $yi = $points[$i]['y'] * $imgH;
            $xj = $points[$j]['x'] * $imgW;
            $yj = $points[$j]['y'] * $imgH;
            $area += ($xi * $yj) - ($xj * $yi);
        }
        $pixelArea = abs($area) / 2;

        return round($pixelArea / ($ppu * $ppu), 4);
    }

    public static function polygonPerimeter(array $points, float $ppu, int $imgW, int $imgH): float
    {
        $n = count($points);
        $total = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $j = ($i + 1) % $n;
            $dx = ($points[$j]['x'] - $points[$i]['x']) * $imgW;
            $dy = ($points[$j]['y'] - $points[$i]['y']) * $imgH;
            $total += sqrt($dx * $dx + $dy * $dy);
        }

        return round($total / $ppu, 4);
    }
}
