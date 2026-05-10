<?php

namespace App\Services\Ost;

use App\Models\ConditionLabourCode;
use App\Models\Drawing;
use App\Models\DrawingMeasurement;
use App\Models\LabourCostCode;
use App\Models\Location;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class OstProductionImporter
{
    use \App\Http\Controllers\Traits\ProductionStatusTrait;

    /**
     * Import object-level production progress from a CSV.
     *
     * Natural key per row: (UID, WorkDate, LccCode) — last write wins on the
     * existing measurement_statuses unique (drawing_measurement_id,
     * labour_cost_code_id, work_date). UID is matched against
     * drawing_measurements.ost_uid (stamped during takeoff import); LccCode
     * against labour_cost_codes.code within the drawing's project location.
     *
     * The CSV's `GUID` column is a per-measurement OST identifier that's
     * unrelated to the condition-level `ost_guid` we store, so we ignore it
     * for matching — `UID` is the per-measurement integer that lines up.
     *
     * Lookup is project-scoped (drawing.project_id) so one CSV can cover all
     * drawings in the project. The drawing argument is only used to resolve
     * the location and is returned for budget-sync orchestration upstream.
     *
     * @return array{
     *   created: int,
     *   updated: int,
     *   skipped: int,
     *   unmatched_guids: int,
     *   sample_unmatched: array<int, string>,
     *   missing_lcc_codes: array<int, array{code: string, count: int}>,
     *   unconfigured_pairs: array<int, array{condition_id: int, condition_name: string, lcc_code: string, count: int}>,
     *   errors: array<int, string>,
     *   affected_dates: array<int, string>,
     *   budget_sync_queued: bool,
     * }
     */
    public function import(Drawing $drawing, string $csvPath): array
    {
        $location = Location::findOrFail($drawing->project_id);

        return $this->importProject($location, $csvPath);
    }

    /**
     * Project-level entry point. Identical fan-out logic as `import()` — rows
     * still match across every drawing in the project by `ost_guid` — but the
     * caller passes the location directly so the UI doesn't need to pick a
     * representative drawing.
     *
     * @return array{
     *   created: int,
     *   updated: int,
     *   skipped: int,
     *   unmatched_guids: int,
     *   sample_unmatched: array<int, string>,
     *   missing_lcc_codes: array<int, array{code: string, count: int}>,
     *   unconfigured_pairs: array<int, array{condition_id: int, condition_name: string, lcc_code: string, count: int}>,
     *   errors: array<int, string>,
     *   affected_dates: array<int, string>,
     *   budget_sync_queued: bool,
     * }
     */
    public function importProject(Location $location, string $csvPath): array
    {
        if (! is_readable($csvPath)) {
            throw new RuntimeException("CSV file not readable: {$csvPath}");
        }

        $rows = $this->readCsv($csvPath);
        $locationId = $location->id;

        // Pre-load every takeoff measurement in the project keyed by ost_uid.
        // UID is per-measurement (integer), unique per measurement row.
        $projectDrawingIds = Drawing::where('project_id', $locationId)->pluck('id');
        $measurementsByUid = DrawingMeasurement::whereIn('drawing_id', $projectDrawingIds)
            ->whereNotNull('ost_uid')
            ->get()
            ->keyBy(fn ($m) => (int) $m->ost_uid);

        // Pre-load LCCs for this location, keyed by code.
        $lccsByCode = LabourCostCode::where('location_id', $locationId)
            ->get()
            ->keyBy(fn ($lcc) => strtoupper(trim($lcc->code)));

        // Pre-load condition_labour_codes once so we can verify the (measurement, LCC)
        // pair without a DB hit per row.
        $conditionIds = $measurementsByUid->pluck('takeoff_condition_id')->filter()->unique()->all();
        $clcByConditionLcc = ConditionLabourCode::whereIn('takeoff_condition_id', $conditionIds)
            ->get()
            ->groupBy('takeoff_condition_id')
            ->map(fn ($group) => $group->pluck('labour_cost_code_id')->all());

        $created = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];
        $unmatchedUids = []; // distinct UIDs in CSV with no matching takeoff
        $missingLccCodes = []; // distinct LCC codes referenced but absent from this location
        $unconfiguredPairs = []; // (condition, lcc) pairs that aren't linked in condition_labour_codes
        $affectedDates = [];

        // First pass: validate every row and collect the rows we'll actually upsert.
        // No DB writes here so cheap to short-circuit on bad input. Each row
        // becomes a flat array ready for `DB::table()->upsert()` so we can
        // skip Eloquent's per-row overhead in the second pass.
        $now = now();
        $updatedBy = auth()->id();
        $rowsToUpsert = [];

        foreach ($rows as $rowNum => $row) {
            $uidRaw = trim((string) ($row['UID'] ?? ''));
            $uid = ($uidRaw !== '' && is_numeric($uidRaw)) ? (int) $uidRaw : null;
            $lccCode = strtoupper(trim((string) ($row['LccCode'] ?? '')));
            $workDate = $this->parseDate($row['WorkDate'] ?? null);
            $percent = $this->parsePercent($row['PercentComplete'] ?? null);

            if ($uid === null) {
                $errors[] = "Row {$rowNum}: missing or non-numeric UID";
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

            $measurement = $measurementsByUid->get($uid);
            if (! $measurement) {
                // Orphan: takeoff exists in OST but not in dpcclock (e.g. drawing
                // never uploaded). Tracked separately from real errors so the UI
                // can present it as informational rather than destructive.
                $unmatchedUids[$uid] = true;
                $skipped++;
                continue;
            }

            $lcc = $lccsByCode->get($lccCode);
            if (! $lcc) {
                // LCC code referenced by OST doesn't exist in this project's
                // labour_cost_codes. Common when project setup hasn't seeded all
                // OST codes yet. Group by code so the user sees one entry per
                // missing code rather than one per row.
                $missingLccCodes[$lccCode] = ($missingLccCodes[$lccCode] ?? 0) + 1;
                $skipped++;
                continue;
            }

            $allowedLccIds = $clcByConditionLcc->get($measurement->takeoff_condition_id, []);
            if (! in_array($lcc->id, $allowedLccIds, true)) {
                // The condition has no link to this LCC in condition_labour_codes —
                // typically because the conditions CSV import hasn't run for these
                // conditions yet. Group by (condition, lcc) so the UI shows one
                // entry per missing pair, not one per measurement.
                $conditionId = $measurement->takeoff_condition_id ?? 0;
                $key = $conditionId . '|' . $lcc->id;
                if (! isset($unconfiguredPairs[$key])) {
                    $unconfiguredPairs[$key] = [
                        'condition_id' => $conditionId,
                        'condition_name' => $measurement->condition?->name ?? '(unknown condition)',
                        'lcc_code' => $lccCode,
                        'count' => 0,
                    ];
                }
                $unconfiguredPairs[$key]['count']++;
                $skipped++;
                continue;
            }

            $rowsToUpsert[] = [
                'drawing_measurement_id' => $measurement->id,
                'labour_cost_code_id' => $lcc->id,
                'work_date' => $workDate,
                'percent_complete' => $percent,
                'updated_by' => $updatedBy,
                'created_at' => $now,
                'updated_at' => $now,
            ];
            $affectedDates[$workDate] = true;
        }

        // Pre-query existing keys so we can split created vs updated counts
        // without per-row updateOrCreate overhead. We narrow with whereIn on
        // (drawing_measurement_id, work_date) — over-fetches a bit (rows for the
        // same drawing/date but a different LCC) but the lookup uses the full
        // triple via the in-memory set so the count stays correct.
        $measurementIds = array_unique(array_column($rowsToUpsert, 'drawing_measurement_id'));
        $workDates = array_unique(array_column($rowsToUpsert, 'work_date'));
        $existingKeySet = [];
        if (! empty($rowsToUpsert)) {
            $existingKeySet = DB::table('measurement_statuses')
                ->whereIn('drawing_measurement_id', $measurementIds)
                ->whereIn('work_date', $workDates)
                ->get(['drawing_measurement_id', 'labour_cost_code_id', 'work_date'])
                ->mapWithKeys(fn ($r) => ["{$r->drawing_measurement_id}|{$r->labour_cost_code_id}|{$r->work_date}" => true])
                ->all();
        }
        foreach ($rowsToUpsert as $r) {
            $key = "{$r['drawing_measurement_id']}|{$r['labour_cost_code_id']}|{$r['work_date']}";
            if (isset($existingKeySet[$key])) {
                $updated++;
            } else {
                $created++;
            }
        }

        // Bulk upsert in chunks. ~30 queries for 14k rows instead of 28k+.
        DB::transaction(function () use ($rowsToUpsert) {
            foreach (array_chunk($rowsToUpsert, 500) as $chunk) {
                DB::table('measurement_statuses')->upsert(
                    $chunk,
                    ['drawing_measurement_id', 'labour_cost_code_id', 'work_date'],
                    ['percent_complete', 'updated_by', 'updated_at'],
                );
            }
        });

        // Defer the BudgetHoursEntry recompute to a queue job. The
        // measurement_statuses upsert above is what actually persists the
        // production data; budget rows are a derived aggregation that the
        // budget page can wait a few seconds for. Doing it inline blew past
        // the request timeout on large imports because each date reloads
        // 30k+ eager-loaded measurements.
        $budgetSyncQueued = false;
        if (! empty($affectedDates)) {
            \App\Jobs\SyncProductionToBudgetJob::dispatch(
                $locationId,
                array_keys($affectedDates),
                auth()->id(),
            );
            $budgetSyncQueued = true;
        }

        // Sort unconfigured pairs by row count desc so the UI shows the
        // highest-impact gaps first.
        uasort($unconfiguredPairs, fn ($a, $b) => $b['count'] <=> $a['count']);

        return [
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'unmatched_guids' => count($unmatchedUids),
            'sample_unmatched' => array_map('strval', array_slice(array_keys($unmatchedUids), 0, 5)),
            'missing_lcc_codes' => array_map(
                fn ($code, $count) => ['code' => $code, 'count' => $count],
                array_keys($missingLccCodes),
                array_values($missingLccCodes),
            ),
            'unconfigured_pairs' => array_values($unconfiguredPairs),
            'errors' => array_slice($errors, 0, 50),
            'affected_dates' => array_keys($affectedDates),
            'budget_sync_queued' => $budgetSyncQueued,
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

        $required = ['UID', 'LccCode', 'WorkDate', 'PercentComplete'];
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
