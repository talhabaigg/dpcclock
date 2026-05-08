<?php

namespace App\Services\Ost;

use App\Models\BidArea;
use App\Models\ConditionType;
use App\Models\Drawing;
use App\Models\DrawingMeasurement;
use App\Models\TakeoffCondition;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class OstTakeoffImporter
{
    /**
     * OST X/Y are stored in 0.01-inch units; multiply by 0.72 to convert to PDF user-space points.
     */
    private const OST_UNIT_TO_PDF_PT = 0.72;

    private const COLOR_PALETTE = [
        '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
        '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
        '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
        '#475569', '#0f766e', '#92400e', '#7c2d12', '#581c87', '#831843',
        '#9f1239', '#155e75', '#1e3a8a', '#312e81', '#365314', '#854d0e',
        '#7c1d6f', '#0c4a6e', '#134e4a',
    ];

    /**
     * Import an OST takeoffs CSV into the given drawing.
     * Wipes any existing scope='takeoff' measurements on the drawing first.
     *
     * @return array{measurements: int, conditions_created: int, bid_areas_created: int, curves: int, skipped: int}
     */
    public function import(Drawing $drawing, string $csvPath, float $pdfWidthPt, float $pdfHeightPt): array
    {
        if (! is_readable($csvPath)) {
            throw new RuntimeException("CSV file not readable: {$csvPath}");
        }

        $rows = $this->readCsv($csvPath);
        $locationId = $drawing->project_id; // drawings.project_id stores the location_id

        return DB::transaction(function () use ($drawing, $rows, $pdfWidthPt, $pdfHeightPt, $locationId) {
            DrawingMeasurement::where('drawing_id', $drawing->id)
                ->where('scope', 'takeoff')
                ->forceDelete();

            $bidAreasCreated = 0;
            $bidAreas = [];

            $conditionsCreated = 0;
            $conditionsByName = [];
            $colorIdx = TakeoffCondition::where('location_id', $locationId)->count();

            $now = now();
            $rowsToInsert = [];
            $curved = 0;
            $skipped = 0;
            // Cache condition_types per location, find-or-create on demand.
            $conditionTypesByName = [];
            $resolveConditionTypeId = function (?string $name) use (&$conditionTypesByName, $locationId): ?int {
                $name = trim((string) $name);
                if ($name === '') return null;
                if (array_key_exists($name, $conditionTypesByName)) return $conditionTypesByName[$name];
                $ct = ConditionType::firstOrCreate(['location_id' => $locationId, 'name' => $name]);
                return $conditionTypesByName[$name] = $ct->id;
            };

            foreach ($rows as $row) {
                $name = trim($row['ConditionName']);
                $kind = $row['Kind'];
                $uom  = $row['CondUOM'];
                $type = $this->mapType($kind, $uom);
                $heightMm = $this->extractHeightMm($name);
                $thickMm = $this->extractWallThicknessMm($name) ?? 100;
                $conditionTypeId = $resolveConditionTypeId($row['ConditionType'] ?? null);

                if (! isset($conditionsByName[$name])) {
                    $tc = TakeoffCondition::where('location_id', $locationId)
                        ->where('name', $name)->first();
                    if (! $tc) {
                        $tc = TakeoffCondition::create([
                            'location_id' => $locationId,
                            'condition_type_id' => $conditionTypeId,
                            'name' => $name,
                            'type' => $type,
                            'color' => self::COLOR_PALETTE[$colorIdx++ % count(self::COLOR_PALETTE)],
                            'description' => "OST import ({$kind}/{$uom})",
                            // Use 'detailed' so the conditions CSV (which lands line items in
                            // condition_line_items) becomes the source of cost calculations.
                            'pricing_method' => 'detailed',
                            'height' => $heightMm ? $heightMm / 1000.0 : null,
                            'thickness' => $type === 'linear' ? $thickMm / 1000.0 : null,
                            'labour_rate_source' => 'manual',
                        ]);
                        $conditionsCreated++;
                    } elseif ($conditionTypeId && $tc->condition_type_id !== $conditionTypeId) {
                        $tc->update(['condition_type_id' => $conditionTypeId]);
                    }
                    $conditionsByName[$name] = $tc;
                }
                $tc = $conditionsByName[$name];

                $areaName = trim($row['AreaName']);
                if (! isset($bidAreas[$areaName])) {
                    $existing = BidArea::where('location_id', $locationId)
                        ->where('name', $areaName)->first();
                    if (! $existing) {
                        $existing = BidArea::create([
                            'location_id' => $locationId,
                            'name' => $areaName,
                            'parent_id' => null,
                            'sort_order' => 0,
                        ]);
                        $bidAreasCreated++;
                    }
                    $bidAreas[$areaName] = $existing;
                }
                $bidArea = $bidAreas[$areaName];

                $position = $row['Position'];
                $curveFlag = (int) $row['Curve'];
                $pairs = OstPositionParser::parsePairs($position);
                $bulge = OstPositionParser::extractBulge($position, $curveFlag);

                [$points, $lengthM, $isCurved] = OstPositionParser::buildPoints(
                    $pairs, $curveFlag, $kind, $uom, $bulge,
                    $pdfWidthPt, $pdfHeightPt, self::OST_UNIT_TO_PDF_PT,
                );
                if (empty($points)) { $skipped++; continue; }
                if ($isCurved) $curved++;

                $myType = $this->mapType($kind, $uom);

                if ($myType === 'count') {
                    $computed = 1.0;
                } elseif (count($points) === 1) {
                    $heightM = $tc->height ?: 0.0;
                    $computed = $heightM > 0 ? $heightM : 1.0;
                } else {
                    $computed = round($lengthM, 4);
                }

                $guid = $this->normalizeGuid($row['GUID'] ?? null);
                $uid = isset($row['UID']) && $row['UID'] !== '' ? (int) $row['UID'] : null;

                $rowsToInsert[] = [
                    'drawing_id' => $drawing->id,
                    'ost_guid' => $guid,
                    'ost_uid' => $uid,
                    'name' => $tc->name,
                    'type' => $myType,
                    'color' => $tc->color,
                    'category' => $row['LayerName'] ?: null,
                    'points' => json_encode($points),
                    'computed_value' => $computed,
                    'unit' => $myType === 'count' ? 'ea' : 'm',
                    'takeoff_condition_id' => $tc->id,
                    'bid_area_id' => $bidArea->id,
                    'scope' => 'takeoff',
                    'created_by' => auth()->id() ?? 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            foreach (array_chunk($rowsToInsert, 200) as $chunk) {
                DB::table('drawing_measurements')->insert($chunk);
            }

            return [
                'measurements' => count($rowsToInsert),
                'conditions_created' => $conditionsCreated,
                'bid_areas_created' => $bidAreasCreated,
                'curves' => $curved,
                'skipped' => $skipped,
            ];
        });
    }

    /** @return array<int, array<string, string>> */
    private function readCsv(string $path): array
    {
        $rows = [];
        $fh = fopen($path, 'r');
        if (! $fh) throw new RuntimeException("Cannot open CSV: {$path}");
        $header = fgetcsv($fh, 0, ',', '"', '\\');
        if (! $header) throw new RuntimeException('CSV is empty or unreadable');

        $required = ['BidConditionUID','GUID','UID','ConditionName','CondUOM','AreaName','Position','Curve'];
        $missing = array_diff($required, $header);
        if (! empty($missing)) {
            fclose($fh);
            throw new RuntimeException('CSV missing required columns: ' . implode(', ', $missing));
        }
        $hasKind = in_array('Kind', $header, true);
        $hasLayerName = in_array('LayerName', $header, true);

        while (($r = fgetcsv($fh, 0, ',', '"', '\\')) !== false) {
            if (count($r) < count($header)) continue;
            $row = array_combine($header, $r);
            // Backfill optional columns when absent so downstream code can rely on them.
            if (! $hasKind) {
                $row['Kind'] = strtoupper(trim($row['CondUOM'])) === 'SM' ? 'Area' : 'Linear';
            }
            if (! $hasLayerName) {
                $row['LayerName'] = '';
            }
            $rows[] = $row;
        }
        fclose($fh);
        return $rows;
    }

    private function mapType(string $kind, string $uom): string
    {
        if ($kind === 'Linear' && $uom === 'EA') return 'count';
        return 'linear';
    }

    /**
     * Normalize an OST GUID. OST emits braced UUIDs like "{623EAC83-...}";
     * we strip braces and lowercase so lookups are case- and format-insensitive.
     */
    private function normalizeGuid(?string $raw): ?string
    {
        if ($raw === null) return null;
        $g = trim($raw, " \t\n\r\0\x0B{}");
        return $g === '' ? null : strtolower($g);
    }

    private function extractHeightMm(string $name): ?int
    {
        if (preg_match('/(\b2800\b|\b3000\b)/', $name, $m)) return (int) $m[1];
        return null;
    }

    private function extractWallThicknessMm(string $name): ?int
    {
        if (! preg_match('/-\s*(.+?)\s*(?:\(|$)/', $name, $m)) return null;
        $body = preg_replace('/\b(2800|3000)\b\s*mm?\s*high.*$/i', '', $m[1]);
        $body = preg_replace('/\b(2800|3000)\s*$/', '', $body);
        $sum = 0;
        $found = false;
        foreach (preg_split('#[/\s]+#', trim($body)) as $t) {
            if (preg_match('/^(\d+)/', $t, $mm)) {
                $n = (int) $mm[1];
                if ($n >= 1000) continue;
                $sum += $n;
                $found = true;
            }
        }
        return $found ? $sum : null;
    }
}
