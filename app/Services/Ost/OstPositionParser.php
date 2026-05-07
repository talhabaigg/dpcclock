<?php

namespace App\Services\Ost;

class OstPositionParser
{
    /**
     * Strip the b'...\n' wrapper, split on ';', and return (x,y) pairs.
     * Trailing scalar (bulge for curves) is excluded.
     *
     * @return array<int, array{0: float, 1: float}>
     */
    public static function parsePairs(string $raw): array
    {
        $tokens = self::tokenize($raw);
        $nums = array_map('floatval', $tokens);
        $pairs = [];
        for ($i = 0; $i + 1 < count($nums); $i += 2) {
            $pairs[] = [$nums[$i], $nums[$i + 1]];
        }
        return $pairs;
    }

    /**
     * Trailing scalar from a curve row (Curve=0): X1;Y1;X2;Y2;Xmid;Ymid;bulge.
     * Returns 0 for non-curve rows or when not enough tokens.
     */
    public static function extractBulge(string $raw, int $curveFlag): float
    {
        if ($curveFlag !== 0) return 0.0;
        $tokens = self::tokenize($raw);
        return count($tokens) >= 7 ? (float) $tokens[6] : 0.0;
    }

    private static function tokenize(string $raw): array
    {
        $s = trim($raw);
        if (str_starts_with($s, "b'")) $s = substr($s, 2);
        if (str_ends_with($s, "'")) $s = substr($s, 0, -1);
        $s = str_replace('\n', '', $s);
        return array_values(array_filter(explode(';', $s), fn ($p) => $p !== ''));
    }

    /**
     * Build a measurement points[] array (UV space) from parsed OST data.
     *
     * @param array<int, array{0: float, 1: float}> $pairs
     * @return array{0: array<int, array<string, float>>, 1: float, 2: bool}
     *   [points[], lengthInMeters, isCurved]
     */
    public static function buildPoints(
        array $pairs,
        int $curveFlag,
        string $kind,
        string $uom,
        float $bulge,
        float $pdfWidthPt,
        float $pdfHeightPt,
        float $ostToPt,
    ): array {
        $uv = fn (float $x, float $y) => [
            'x' => round($x * $ostToPt / $pdfWidthPt, 6),
            'y' => round($y * $ostToPt / $pdfHeightPt, 6),
        ];
        // Calibration: A1 1:100 metric → 28.3464566929 PDF pts per real meter.
        $pdfPtPerMeter = (72.0 / 25.4) * (1000.0 / 100.0);

        // Single-point markers (counts, junctions).
        if ($kind === 'Linear' && in_array($uom, ['EA', 'LM'], true)) {
            $p = $pairs[0] ?? [0, 0];
            return [[$uv($p[0], $p[1])], 0.0, false];
        }

        // Curved arc: V1 (start), V2 (end), V3 (side reference), bulge = signed sagitta in OST units.
        if ($curveFlag === 0 && count($pairs) >= 3 && abs($bulge) > 1e-6) {
            $v1 = $pairs[0]; $v2 = $pairs[1]; $v3 = $pairs[2];
            $cmx = ($v1[0] + $v2[0]) / 2;
            $cmy = ($v1[1] + $v2[1]) / 2;
            $chDx = $v2[0] - $v1[0];
            $chDy = $v2[1] - $v1[1];
            $chLen = sqrt($chDx * $chDx + $chDy * $chDy);
            if ($chLen < 1e-6) {
                return self::straight($v1, $v2, $uv, $ostToPt, $pdfPtPerMeter);
            }
            $perpX = $chDy / $chLen;
            $perpY = -$chDx / $chLen;
            $dotV3 = ($v3[0] - $cmx) * $perpX + ($v3[1] - $cmy) * $perpY;
            $sgn = $dotV3 >= 0 ? 1 : -1;
            $amx = $cmx + $sgn * $bulge * $perpX;
            $amy = $cmy + $sgn * $bulge * $perpY;

            // Circle through V1, arc-midpoint, V2.
            $ax = $v1[0]; $ay = $v1[1];
            $bx = $amx;   $by = $amy;
            $cx = $v2[0]; $cy = $v2[1];
            $D = 2 * ($ax * ($by - $cy) + $bx * ($cy - $ay) + $cx * ($ay - $by));
            if (abs($D) < 1e-9) {
                return self::straight($v1, $v2, $uv, $ostToPt, $pdfPtPerMeter);
            }
            $ox = (($ax**2 + $ay**2) * ($by - $cy) + ($bx**2 + $by**2) * ($cy - $ay) + ($cx**2 + $cy**2) * ($ay - $by)) / $D;
            $oy = (($ax**2 + $ay**2) * ($cx - $bx) + ($bx**2 + $by**2) * ($ax - $cx) + ($cx**2 + $cy**2) * ($bx - $ax)) / $D;
            $r0x = $ax - $ox; $r0y = $ay - $oy;
            $R = sqrt($r0x * $r0x + $r0y * $r0y);
            if ($R < 1e-6) {
                return self::straight($v1, $v2, $uv, $ostToPt, $pdfPtPerMeter);
            }

            $t0 = atan2($r0y, $r0x);
            $tm = atan2($amy - $oy, $amx - $ox);
            $t2 = atan2($cy - $oy, $cx - $ox);
            $ccwSweep = $t2 - $t0;  while ($ccwSweep < 0) $ccwSweep += 2 * M_PI;
            $ccwTm    = $tm - $t0;  while ($ccwTm    < 0) $ccwTm    += 2 * M_PI;
            if ($ccwTm > 0 && $ccwTm < $ccwSweep) {
                $sweep = $ccwSweep; $dir = 1;
            } else {
                $sweep = 2 * M_PI - $ccwSweep; $dir = -1;
            }

            // Split arc so each cubic-Bezier segment ≤ 90°.
            $segCount = max(1, (int) ceil($sweep / (M_PI / 2)));
            $segSweep = $sweep / $segCount;
            $alpha = (4.0 / 3.0) * tan($segSweep / 4);

            $points = [];
            for ($i = 0; $i <= $segCount; $i++) {
                $angle = $t0 + $dir * $i * $segSweep;
                $px = $ox + $R * cos($angle);
                $py = $oy + $R * sin($angle);
                $point = $uv($px, $py);
                $rx = $px - $ox; $ry = $py - $oy;
                $tanx = -$ry * $dir;
                $tany =  $rx * $dir;
                if ($i < $segCount) {
                    $point['hox'] = round(($alpha * $tanx) * $ostToPt / $pdfWidthPt, 6);
                    $point['hoy'] = round(($alpha * $tany) * $ostToPt / $pdfHeightPt, 6);
                }
                if ($i > 0) {
                    $point['hix'] = round((-$alpha * $tanx) * $ostToPt / $pdfWidthPt, 6);
                    $point['hiy'] = round((-$alpha * $tany) * $ostToPt / $pdfHeightPt, 6);
                }
                $points[] = $point;
            }

            return [$points, $R * $sweep * $ostToPt / $pdfPtPerMeter, true];
        }

        // Straight 2-vertex segment (Area Kind walls or Linear LM polylines).
        $segPts = [];
        foreach ($pairs as $i => $p) {
            if ($i >= 2 && abs($p[0]) < 1 && abs($p[1]) < 1) break;
            if (count($segPts) >= 2) break;
            $segPts[] = $p;
        }
        if (count($segPts) < 2) {
            $p = $segPts[0] ?? [0, 0];
            return [[$uv($p[0], $p[1])], 0.0, false];
        }
        $points = array_map(fn ($p) => $uv($p[0], $p[1]), $segPts);
        $len = 0.0;
        for ($i = 1; $i < count($segPts); $i++) {
            $dx = ($segPts[$i][0] - $segPts[$i-1][0]) * $ostToPt;
            $dy = ($segPts[$i][1] - $segPts[$i-1][1]) * $ostToPt;
            $len += sqrt($dx * $dx + $dy * $dy);
        }
        return [$points, $len / $pdfPtPerMeter, false];
    }

    /** @return array{0: array<int, array<string, float>>, 1: float, 2: bool} */
    private static function straight(array $v1, array $v2, callable $uv, float $ostToPt, float $pdfPtPerMeter): array
    {
        $dx = ($v2[0] - $v1[0]) * $ostToPt;
        $dy = ($v2[1] - $v1[1]) * $ostToPt;
        return [[$uv($v1[0], $v1[1]), $uv($v2[0], $v2[1])], sqrt($dx * $dx + $dy * $dy) / $pdfPtPerMeter, false];
    }
}
