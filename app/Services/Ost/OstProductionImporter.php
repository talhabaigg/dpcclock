<?php

namespace App\Services\Ost;

use App\Models\ConditionLabourCode;
use App\Models\Drawing;
use App\Models\DrawingMeasurement;
use App\Models\LabourCostCode;
use App\Models\MeasurementStatus;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class OstProductionImporter
{
    /**
     * Import object-level production progress from a CSV.
     *
     * Natural key per row: (GUID, WorkDate, LccCode) — last write wins on the
     * existing measurement_statuses unique (drawing_measurement_id,
     * labour_cost_code_id, work_date). GUID is matched against
     * drawing_measurements.ost_guid (stamped during takeoff import); LccCode
     * against labour_cost_codes.code within the drawing's project location.
     *
     * Lookup is project-scoped (drawing.project_id) so one CSV can cover all
     * drawings in the project. The drawing argument is only used to resolve
     * the location and is returned for budget-sync orchestration upstream.
     *
     * @return array{
     *   created: int,
     *   updated: int,
     *   skipped: int,
     *   errors: array<int, string>,
     *   affected_dates: array<int, string>,
     * }
     */
    public function import(Drawing $drawing, string $csvPath): array
    {
        if (! is_readable($csvPath)) {
            throw new RuntimeException("CSV file not readable: {$csvPath}");
        }

        $rows = $this->readCsv($csvPath);
        $locationId = $drawing->project_id;

        // Pre-load every takeoff measurement in the project keyed by ost_guid.
        // ost_guid is stored normalized (lowercase, no braces) by the takeoff importer.
        $projectDrawingIds = Drawing::where('project_id', $locationId)->pluck('id');
        $measurementsByGuid = DrawingMeasurement::whereIn('drawing_id', $projectDrawingIds)
            ->whereNotNull('ost_guid')
            ->get()
            ->keyBy('ost_guid');

        // Pre-load LCCs for this location, keyed by code.
        $lccsByCode = LabourCostCode::where('location_id', $locationId)
            ->get()
            ->keyBy(fn ($lcc) => strtoupper(trim($lcc->code)));

        // Pre-load condition_labour_codes once so we can verify the (measurement, LCC)
        // pair without a DB hit per row.
        $conditionIds = $measurementsByGuid->pluck('takeoff_condition_id')->filter()->unique()->all();
        $clcByConditionLcc = ConditionLabourCode::whereIn('takeoff_condition_id', $conditionIds)
            ->get()
            ->groupBy('takeoff_condition_id')
            ->map(fn ($group) => $group->pluck('labour_cost_code_id')->all());

        $created = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];
        $affectedDates = [];

        DB::transaction(function () use (
            $rows,
            $measurementsByGuid,
            $lccsByCode,
            $clcByConditionLcc,
            &$created,
            &$updated,
            &$skipped,
            &$errors,
            &$affectedDates,
        ) {
            foreach ($rows as $rowNum => $row) {
                $guid = $this->normalizeGuid($row['GUID'] ?? null);
                $lccCode = strtoupper(trim((string) ($row['LccCode'] ?? '')));
                $workDate = $this->parseDate($row['WorkDate'] ?? null);
                $percent = $this->parsePercent($row['PercentComplete'] ?? null);

                if (! $guid) {
                    $errors[] = "Row {$rowNum}: missing GUID";
                    $skipped++;
                    continue;
                }
                if ($lccCode === '') {
                    $errors[] = "Row {$rowNum}: missing LccCode";
                    $skipped++;
                    continue;
                }
                if (! $workDate) {
                    $errors[] = "Row {$rowNum}: invalid WorkDate";
                    $skipped++;
                    continue;
                }
                if ($percent === null) {
                    $errors[] = "Row {$rowNum}: PercentComplete must be 0-100";
                    $skipped++;
                    continue;
                }

                $measurement = $measurementsByGuid->get($guid);
                if (! $measurement) {
                    $errors[] = "Row {$rowNum}: GUID {$guid} not found in takeoffs (re-import takeoff first)";
                    $skipped++;
                    continue;
                }

                $lcc = $lccsByCode->get($lccCode);
                if (! $lcc) {
                    $errors[] = "Row {$rowNum}: LccCode '{$lccCode}' not found in this location";
                    $skipped++;
                    continue;
                }

                $allowedLccIds = $clcByConditionLcc->get($measurement->takeoff_condition_id, []);
                if (! in_array($lcc->id, $allowedLccIds, true)) {
                    $errors[] = "Row {$rowNum}: LccCode '{$lccCode}' is not configured on condition for GUID {$guid}";
                    $skipped++;
                    continue;
                }

                // Last-write-wins on the natural key. updateOrCreate returns
                // wasRecentlyCreated so we can split the create/update counts.
                $status = MeasurementStatus::updateOrCreate(
                    [
                        'drawing_measurement_id' => $measurement->id,
                        'labour_cost_code_id' => $lcc->id,
                        'work_date' => $workDate,
                    ],
                    [
                        'percent_complete' => $percent,
                        'updated_by' => auth()->id(),
                    ]
                );

                if ($status->wasRecentlyCreated) {
                    $created++;
                } else {
                    $updated++;
                }
                $affectedDates[$workDate] = true;
            }
        });

        return [
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'errors' => array_slice($errors, 0, 50),
            'affected_dates' => array_keys($affectedDates),
        ];
    }

    /** @return array<int, array<string, string>> */
    private function readCsv(string $path): array
    {
        $rows = [];
        $fh = fopen($path, 'r');
        if (! $fh) {
            throw new RuntimeException("Cannot open CSV: {$path}");
        }
        $header = fgetcsv($fh, 0, ',', '"', '\\');
        if (! $header) {
            throw new RuntimeException('CSV is empty or unreadable');
        }

        $required = ['GUID', 'LccCode', 'WorkDate', 'PercentComplete'];
        $missing = array_diff($required, $header);
        if (! empty($missing)) {
            fclose($fh);
            throw new RuntimeException('CSV missing required columns: ' . implode(', ', $missing));
        }

        $rowNum = 1;
        while (($r = fgetcsv($fh, 0, ',', '"', '\\')) !== false) {
            $rowNum++;
            if (count($r) < count($header)) {
                continue;
            }
            $rows[$rowNum] = array_combine($header, $r);
        }
        fclose($fh);

        return $rows;
    }

    private function normalizeGuid(?string $raw): ?string
    {
        if ($raw === null) {
            return null;
        }
        $g = trim($raw, " \t\n\r\0\x0B{}");

        return $g === '' ? null : strtolower($g);
    }

    /** Accepts ISO (YYYY-MM-DD) or common locale formats. Returns YYYY-MM-DD or null. */
    private function parseDate(?string $raw): ?string
    {
        $raw = trim((string) $raw);
        if ($raw === '') {
            return null;
        }
        try {
            return Carbon::parse($raw)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    private function parsePercent(?string $raw): ?int
    {
        $raw = trim((string) $raw);
        if ($raw === '' || ! is_numeric($raw)) {
            return null;
        }
        $n = (int) round((float) $raw);
        if ($n < 0 || $n > 100) {
            return null;
        }

        return $n;
    }
}
