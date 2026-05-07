<?php

namespace App\Services\Ost;

use App\Models\ConditionLineItem;
use App\Models\ConditionType;
use App\Models\Location;
use App\Models\TakeoffCondition;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class OstConditionsImporter
{
    private const COLOR_PALETTE = [
        '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
        '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
        '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
        '#475569', '#0f766e', '#92400e', '#7c2d12', '#581c87', '#831843',
        '#9f1239', '#155e75', '#1e3a8a', '#312e81', '#365314', '#854d0e',
        '#7c1d6f', '#0c4a6e', '#134e4a',
    ];

    /**
     * Import an OST conditions/pricing CSV. Replaces all condition_line_items for
     * each condition (matched by name; created if missing).
     *
     * Pricing convention from OST → our schema:
     *   UnitMatRate > 0  → material line: unit_cost = UnitMatRate, pack_size = PricedBy
     *   UnitMatRate == 0 → labour line: production_rate = 1 / LabProd_HrsPerUOM (UOM per hour)
     *
     * @return array{conditions_updated: int, conditions_created: int, line_items_inserted: int}
     */
    public function import(Location $location, string $csvPath): array
    {
        if (! is_readable($csvPath)) {
            throw new RuntimeException("CSV file not readable: {$csvPath}");
        }

        $rows = $this->readCsv($csvPath);

        return DB::transaction(function () use ($location, $rows) {
            // Group rows by condition name.
            $byName = [];
            foreach ($rows as $row) {
                $name = trim($row['ConditionName']);
                $byName[$name][] = $row;
            }

            $updated = 0;
            $created = 0;
            $inserted = 0;
            $labourCodesCreated = 0;
            $now = now();
            $colorIdx = TakeoffCondition::where('location_id', $location->id)->count();
            $conditionTypesByName = [];
            $resolveConditionTypeId = function (?string $typeName) use (&$conditionTypesByName, $location): ?int {
                $typeName = trim((string) $typeName);
                if ($typeName === '') return null;
                if (array_key_exists($typeName, $conditionTypesByName)) return $conditionTypesByName[$typeName];
                $ct = ConditionType::firstOrCreate(['location_id' => $location->id, 'name' => $typeName]);
                return $conditionTypesByName[$typeName] = $ct->id;
            };

            // Build a (code → labour_cost_codes.id) cache; missing entries are created on demand.
            $labourCodeIds = \DB::table('labour_cost_codes')
                ->where('location_id', $location->id)
                ->pluck('id', 'code')->toArray();
            $masterRate = (float) ($location->master_hourly_rate ?? 0);

            $resolveLabourCode = function (string $code, string $name, ?string $uom, ?float $hrsPerUom) use (&$labourCodeIds, &$labourCodesCreated, $location, $now, $masterRate): ?int {
                if ($code === '') return null;
                if (isset($labourCodeIds[$code])) return $labourCodeIds[$code];
                $id = \DB::table('labour_cost_codes')->insertGetId([
                    'location_id' => $location->id,
                    'code' => $code,
                    'name' => substr($name, 0, 255),
                    'unit' => $uom ?: null,
                    'default_production_rate' => $hrsPerUom && $hrsPerUom > 0 ? round(1.0 / $hrsPerUom, 6) : null,
                    'default_hourly_rate' => $masterRate > 0 ? $masterRate : null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $labourCodeIds[$code] = $id;
                $labourCodesCreated++;
                return $id;
            };

            foreach ($byName as $name => $lineRows) {
                $cond = TakeoffCondition::where('location_id', $location->id)
                    ->where('name', $name)->first();
                $first = $lineRows[0];
                $conditionTypeId = $resolveConditionTypeId($first['ConditionType'] ?? null);

                if (! $cond) {
                    $uom = strtoupper(trim($first['CondUOM'] ?? ''));
                    $type = $uom === 'EA' ? 'count' : 'linear';
                    // Only walls (CondUOM=SM) get a height. Linear accessories (LM)
                    // and counts (EA) leave height null so they don't get an
                    // unintended lm→m² multiplier in cost calculations.
                    $heightM = $uom === 'SM' && isset($first['CondHeight'])
                        ? round((float) $first['CondHeight'] / 10000.0, 3)
                        : null;
                    $thickMm = $this->extractWallThicknessMm($name);

                    $cond = TakeoffCondition::create([
                        'location_id' => $location->id,
                        'condition_type_id' => $conditionTypeId,
                        'name' => $name,
                        'type' => $type,
                        'color' => self::COLOR_PALETTE[$colorIdx++ % count(self::COLOR_PALETTE)],
                        'description' => "OST conditions import (UOM={$uom})",
                        // Use unit_rate so the per-UOM aggregate from OST CondMatTotal/CondLabTotal
                        // (stored in BoQ items) drives cost. Detailed line items still exist for
                        // DPC tracking via condition_labour_codes.
                        'pricing_method' => 'unit_rate',
                        'height' => $heightM,
                        'thickness' => $type === 'linear' && $thickMm ? $thickMm / 1000.0 : null,
                        'labour_rate_source' => 'manual',
                    ]);
                    $created++;
                } else {
                    // Re-imports: align pricing_method to unit_rate so the BoQ
                    // rates we're about to populate actually drive cost. User
                    // can switch back to 'detailed' per-condition later.
                    $patches = ['pricing_method' => 'unit_rate'];
                    if ($conditionTypeId && $cond->condition_type_id !== $conditionTypeId) {
                        $patches['condition_type_id'] = $conditionTypeId;
                    }
                    $cond->update($patches);
                    $updated++;
                }

                ConditionLineItem::where('takeoff_condition_id', $cond->id)->delete();
                // Also clear the condition↔labour-code pivot and BoQ items so re-imports don't duplicate.
                \DB::table('condition_labour_codes')->where('takeoff_condition_id', $cond->id)->delete();
                \DB::table('takeoff_condition_boq_items')->where('takeoff_condition_id', $cond->id)->delete();
                $clcByCodeId = []; // labour_cost_code_id → first hrsPerUom we see for this condition

                // Per-UOM rates: prefer the OST-provided values (new format columns),
                // else compute from totals ÷ qty (old format with CondMatTotal + CdnQty).
                $uomUpper = strtoupper(trim($first['CondUOM'] ?? ''));
                if (isset($first['CondMatPerUOM']) || isset($first['CondLabPerUOM'])) {
                    $matRate = (float) ($first['CondMatPerUOM'] ?? 0);
                    $labRate = (float) ($first['CondLabPerUOM'] ?? 0);
                    $measuredQty = (float) ($first['MeasuredQty'] ?? 0);
                    $rateSource = "OST CondMat/LabPerUOM (measured qty: {$measuredQty} {$uomUpper})";
                } else {
                    $matTotal = (float) ($first['CondMatTotal'] ?? 0);
                    $labTotal = (float) ($first['CondLabTotal'] ?? 0);
                    $rawCdnQty = 0.0;
                    foreach ($lineRows as $lr) {
                        if (strtoupper(trim($lr['ItemUOM'] ?? '')) === $uomUpper) {
                            $candidate = (float) ($lr['CdnQty'] ?? 0);
                            if ($candidate > $rawCdnQty) $rawCdnQty = $candidate;
                        }
                    }
                    if ($rawCdnQty <= 0) $rawCdnQty = (float) ($first['CdnQty'] ?? 0);
                    $cdnQty = match ($uomUpper) {
                        'SM' => $rawCdnQty / 1e8,
                        'LM' => $rawCdnQty / 1e4,
                        default => $rawCdnQty,
                    };
                    $matRate = $cdnQty > 0 && $matTotal > 0 ? round($matTotal / $cdnQty, 4) : 0;
                    $labRate = $cdnQty > 0 && $labTotal > 0 ? round($labTotal / $cdnQty, 4) : 0;
                    $rateSource = "OST aggregate (\${$matTotal} mat, \${$labTotal} lab ÷ {$cdnQty} {$uomUpper})";
                }
                $boqRows = [];
                if ($matRate > 0) {
                    $boqRows[] = [
                        'takeoff_condition_id' => $cond->id,
                        'kind' => 'material',
                        'cost_code_id' => null,
                        'labour_cost_code_id' => null,
                        'unit_rate' => $matRate,
                        'production_rate' => null,
                        'notes' => $rateSource,
                        'sort_order' => 1,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
                if ($labRate > 0) {
                    $boqRows[] = [
                        'takeoff_condition_id' => $cond->id,
                        'kind' => 'labour',
                        'cost_code_id' => null,
                        'labour_cost_code_id' => null,
                        'unit_rate' => $labRate,
                        'production_rate' => null,
                        'notes' => $rateSource,
                        'sort_order' => 2,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
                if (! empty($boqRows)) {
                    \DB::table('takeoff_condition_boq_items')->insert($boqRows);
                }

                $batch = [];
                foreach ($lineRows as $r) {
                    $matRate  = (float) $r['UnitMatRate'];
                    $hrsPerUom = (float) $r['LabProd_HrsPerUOM'];
                    $isMaterial = $matRate > 0;
                    // Prefer the explicit LineLabCode (e.g. "101_INT_FRM") for labour codes;
                    // fall back to the per-row Code (e.g. "1102") on the older export.
                    $rawLineLabCode = isset($r['LineLabCode']) ? trim($r['LineLabCode']) : '';
                    $code = trim($r['Code']);
                    $labourCode = $rawLineLabCode !== '' ? $rawLineLabCode : $code;
                    $labourCodeId = ! $isMaterial
                        ? $resolveLabourCode($labourCode, trim($r['Description']), trim($r['ItemUOM']), $hrsPerUom)
                        : null;
                    if ($labourCodeId && ! isset($clcByCodeId[$labourCodeId])) {
                        $clcByCodeId[$labourCodeId] = $hrsPerUom;
                    }

                    $batch[] = [
                        'takeoff_condition_id' => $cond->id,
                        'sort_order' => (int) (float) $r['Sequence'],
                        'section' => trim($r['SectionName']) ?: null,
                        'entry_type' => $isMaterial ? 'material' : 'labour',
                        'material_item_id' => null,
                        'labour_cost_code_id' => $labourCodeId,
                        'item_code' => $code ?: null,
                        'description' => trim($r['Description']) ?: null,
                        'qty_source' => 'primary',
                        'fixed_qty' => null,
                        'oc_spacing' => null,
                        'layers' => 1,
                        'waste_percentage' => 0,
                        'unit_cost' => $isMaterial ? $matRate : null,
                        'cost_source' => 'manual',
                        'uom' => trim($r['ItemUOM']) ?: null,
                        // PricedBy in OST is "priced per N units" — store as pack_size.
                        'pack_size' => $isMaterial && (float) $r['PricedBy'] > 0 ? (float) $r['PricedBy'] : null,
                        'hourly_rate' => null,
                        // OST stores hours-per-UOM; our calculator wants UOM-per-hour (effectiveQty / production_rate = hours).
                        'production_rate' => ! $isMaterial && $hrsPerUom > 0 ? 1.0 / $hrsPerUom : null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }

                foreach (array_chunk($batch, 200) as $chunk) {
                    DB::table('condition_line_items')->insert($chunk);
                }

                // Populate the condition↔labour-code pivot the production/DPC page reads from.
                $clcRows = [];
                foreach ($clcByCodeId as $lccId => $hrsPerUom) {
                    $clcRows[] = [
                        'takeoff_condition_id' => $cond->id,
                        'labour_cost_code_id' => $lccId,
                        'production_rate' => $hrsPerUom > 0 ? round(1.0 / $hrsPerUom, 6) : null,
                        'hourly_rate' => $masterRate > 0 ? $masterRate : null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
                if (! empty($clcRows)) {
                    \DB::table('condition_labour_codes')->insert($clcRows);
                }

                $inserted += count($batch);
            }

            return [
                'conditions_updated' => $updated,
                'conditions_created' => $created,
                'line_items_inserted' => $inserted,
                'labour_codes_created' => $labourCodesCreated,
            ];
        });
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

    /** @return array<int, array<string, string>> */
    private function readCsv(string $path): array
    {
        $rows = [];
        $fh = fopen($path, 'r');
        if (! $fh) throw new RuntimeException("Cannot open CSV: {$path}");
        $header = fgetcsv($fh, 0, ',', '"', '\\');
        if (! $header) throw new RuntimeException('CSV is empty or unreadable');

        $required = ['ConditionName','Sequence','Code','Description','ItemUOM','UnitMatRate','PricedBy','LabProd_HrsPerUOM'];
        $missing = array_diff($required, $header);
        if (! empty($missing)) {
            fclose($fh);
            throw new RuntimeException('CSV missing required columns: ' . implode(', ', $missing));
        }

        while (($r = fgetcsv($fh, 0, ',', '"', '\\')) !== false) {
            if (count($r) < count($header)) continue;
            $row = array_combine($header, $r);
            // The new "per_uom" export uses Section/Sect; old export uses SectionName/SectionNo. Normalize.
            if (! isset($row['SectionName']) && isset($row['Section'])) {
                $row['SectionName'] = $row['Section'];
            }
            $rows[] = $row;
        }
        fclose($fh);
        return $rows;
    }
}
