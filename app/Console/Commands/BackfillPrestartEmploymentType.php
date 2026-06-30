<?php

namespace App\Console\Commands;

use App\Models\DailyPrestartSignature;
use App\Models\Employee;
use App\Models\PayRun;
use App\Models\PrestartAbsentee;
use App\Services\EmploymentHeroService;
use Illuminate\Console\Command;

/**
 * Backfills prestart_absentees.employment_type and daily_prestart_signatures.employment_type
 * for legacy rows that predate the snapshot hook on those models.
 *
 * Source of truth: Employment Hero earnings lines for the pay run covering the prestart's
 * work_date. An employee is Casual if any of their earnings lines for that pay run has a
 * payCategoryName containing "Casual"; otherwise Full Time.
 *
 * Fallback: if an employee has no earnings in the covering pay run (truly absent the whole
 * period) we walk backward through earlier pay runs and use the classification from the most
 * recent prior pay run where they did have earnings lines.
 *
 * Idempotent — only touches rows where employment_type is NULL or ''.
 */
class BackfillPrestartEmploymentType extends Command
{
    protected $signature = 'prestart:backfill-employment-type
        {--dry-run : Show what would change without writing}';

    protected $description = 'Backfill employment_type on prestart_absentees and daily_prestart_signatures from EH pay run earnings lines.';

    /**
     * Per pay run, per employee classification verdict.
     * ehPayRunId => empId => 'Casual' | 'Full Time'
     * Employees with no earnings lines in the pay run are absent from the inner map.
     *
     * @var array<int, array<string, string>>
     */
    private array $verdicts = [];

    /** @var array<int, bool> ehPayRunId => fetch attempted (true = ok, false = failed) */
    private array $fetchAttempted = [];

    private EmploymentHeroService $eh;

    public function handle(EmploymentHeroService $eh): int
    {
        $this->eh = $eh;
        $dryRun = (bool) $this->option('dry-run');

        $this->info($dryRun ? 'DRY RUN — no writes will be made.' : 'Live run — rows will be updated.');

        // 1. Rows that need a value.
        $absenteeRows = PrestartAbsentee::query()
            ->join('daily_prestarts', 'daily_prestarts.id', '=', 'prestart_absentees.daily_prestart_id')
            ->whereNotNull('prestart_absentees.employee_id')
            ->where(function ($q) {
                $q->whereNull('prestart_absentees.employment_type')
                  ->orWhere('prestart_absentees.employment_type', '');
            })
            ->select('prestart_absentees.id as row_id', 'prestart_absentees.employee_id', 'daily_prestarts.work_date')
            ->get();

        $signatureRows = DailyPrestartSignature::query()
            ->join('daily_prestarts', 'daily_prestarts.id', '=', 'daily_prestart_signatures.daily_prestart_id')
            ->whereNotNull('daily_prestart_signatures.employee_id')
            ->where(function ($q) {
                $q->whereNull('daily_prestart_signatures.employment_type')
                  ->orWhere('daily_prestart_signatures.employment_type', '');
            })
            ->select('daily_prestart_signatures.id as row_id', 'daily_prestart_signatures.employee_id', 'daily_prestarts.work_date')
            ->get();

        $this->line("Absentee rows needing backfill: {$absenteeRows->count()}");
        $this->line("Signature rows needing backfill: {$signatureRows->count()}");

        if ($absenteeRows->isEmpty() && $signatureRows->isEmpty()) {
            $this->info('Nothing to backfill.');
            return self::SUCCESS;
        }

        // 2. Resolve internal employee_id -> eh_employee_id.
        $allEmployeeIds = $absenteeRows->pluck('employee_id')
            ->merge($signatureRows->pluck('employee_id'))
            ->unique()
            ->values();

        $employeesById = Employee::withTrashed()
            ->whereIn('id', $allEmployeeIds)
            ->get(['id', 'eh_employee_id', 'employment_type'])
            ->keyBy('id');

        $ehIdByEmpId = $employeesById->mapWithKeys(fn ($e) => [$e->id => $e->eh_employee_id])->toArray();
        $currentTypeByEmpId = $employeesById->mapWithKeys(fn ($e) => [$e->id => $e->employment_type])->toArray();

        // 3. Load every pay run we have locally, newest first. The covering pay run gets
        // queried first; if the employee was absent we walk further back through this list.
        $payRunsDesc = PayRun::query()
            ->whereNotNull('eh_pay_run_id')
            ->orderBy('pay_period_starting', 'desc')
            ->get();

        if ($payRunsDesc->isEmpty()) {
            $this->error('No local pay runs found. Run "Sync Pay Runs" on the dashboard first.');
            return self::FAILURE;
        }

        // 4. Classify each row.
        $stats = [
            'absentees' => ['updated' => 0, 'updated_from_current' => 0, 'no_classification' => 0],
            'signatures' => ['updated' => 0, 'updated_from_current' => 0, 'no_classification' => 0],
        ];
        $writtenByClass = ['Casual' => 0, 'Full Time' => 0];
        $unclassified = ['absentees' => [], 'signatures' => []];

        foreach (['absentees' => [PrestartAbsentee::class, $absenteeRows], 'signatures' => [DailyPrestartSignature::class, $signatureRows]] as $table => [$modelClass, $rows]) {
            foreach ($rows as $r) {
                $ehEmp = $ehIdByEmpId[$r->employee_id] ?? null;
                if (!$ehEmp) {
                    $unclassified[$table][] = "row #{$r->row_id}: missing eh_employee_id for employee {$r->employee_id}";
                    $stats[$table]['no_classification']++;
                    continue;
                }

                $classification = $this->classifyEmployeeAsOf((string) $ehEmp, (string) $r->work_date, $payRunsDesc);
                $fromCurrent = false;
                if ($classification === null) {
                    // Fallback: use the current employees.employment_type. Typical case is a
                    // newly-onboarded worker who appeared on a prestart before their first
                    // pay run was cut — staleness risk is essentially zero.
                    $current = $currentTypeByEmpId[$r->employee_id] ?? null;
                    if ($current === 'Casual' || $current === 'Full Time' || $current === 'Part Time') {
                        $classification = $current === 'Casual' ? 'Casual' : 'Full Time';
                        $fromCurrent = true;
                    }
                }

                if ($classification === null) {
                    $unclassified[$table][] = "row #{$r->row_id}: eh_employee {$ehEmp} has no pay run history and current employment_type is blank";
                    $stats[$table]['no_classification']++;
                    continue;
                }

                $writtenByClass[$classification] = ($writtenByClass[$classification] ?? 0) + 1;
                if (!$dryRun) {
                    $modelClass::whereKey($r->row_id)->update(['employment_type' => $classification]);
                }
                $stats[$table]['updated']++;
                if ($fromCurrent) {
                    $stats[$table]['updated_from_current']++;
                }
            }
        }

        $this->newLine();
        $this->info('── Backfill summary ──');
        $this->line(sprintf('Pay runs fetched from EH: %d (failed: %d)',
            count(array_filter($this->fetchAttempted, fn ($ok) => $ok === true)),
            count(array_filter($this->fetchAttempted, fn ($ok) => $ok === false)),
        ));
        $this->line(sprintf('Absentees:  %d updated (%d via current-employee fallback), %d unclassified',
            $stats['absentees']['updated'], $stats['absentees']['updated_from_current'], $stats['absentees']['no_classification']));
        $this->line(sprintf('Signatures: %d updated (%d via current-employee fallback), %d unclassified',
            $stats['signatures']['updated'], $stats['signatures']['updated_from_current'], $stats['signatures']['no_classification']));
        $this->line(sprintf('Classifications written: Casual=%d, Full Time=%d', $writtenByClass['Casual'] ?? 0, $writtenByClass['Full Time'] ?? 0));

        foreach (['absentees', 'signatures'] as $table) {
            if (!empty($unclassified[$table])) {
                $this->warn(sprintf('%s: %d unclassified rows (sample):', $table, count($unclassified[$table])));
                foreach (array_slice($unclassified[$table], 0, 5) as $msg) {
                    $this->line("  {$msg}");
                }
                if (count($unclassified[$table]) > 5) {
                    $this->line('  …');
                }
            }
        }

        if ($dryRun) {
            $this->newLine();
            $this->info('Dry run complete. Re-run without --dry-run to apply.');
        }

        return self::SUCCESS;
    }

    /**
     * Find the employee's classification as of $workDate.
     *
     * Walks pay runs newest-first starting from the one covering $workDate (or the most
     * recent pay run ending on/before it). Returns 'Casual' | 'Full Time' from the first
     * pay run in which the employee has earnings lines, or null if no prior pay run has any.
     */
    private function classifyEmployeeAsOf(string $ehEmployeeId, string $workDate, $payRunsDesc): ?string
    {
        foreach ($payRunsDesc as $pr) {
            // Skip pay runs that start strictly after the work_date — we only want
            // ones that cover the date or precede it.
            $payPeriodStart = (string) $pr->pay_period_starting->format('Y-m-d');
            if ($payPeriodStart > $workDate) {
                continue;
            }

            $this->ensurePayRunFetched((int) $pr->eh_pay_run_id);
            if (($this->fetchAttempted[(int) $pr->eh_pay_run_id] ?? false) === false) {
                continue;
            }

            $verdict = $this->verdicts[(int) $pr->eh_pay_run_id][$ehEmployeeId] ?? null;
            if ($verdict !== null) {
                return $verdict;
            }
            // No verdict => employee had no earnings lines in this pay run. Keep walking back.
        }

        return null;
    }

    /**
     * Fetch a pay run's earnings lines once, classify every employee, store only the verdict.
     * The raw payload is discarded so memory stays flat regardless of how many pay runs we walk.
     */
    private function ensurePayRunFetched(int $ehPayRunId): void
    {
        if (array_key_exists($ehPayRunId, $this->fetchAttempted)) {
            return;
        }

        $this->line("  → fetching earnings for pay run {$ehPayRunId}");
        try {
            $payload = $this->eh->getEarningsLines($ehPayRunId);
        } catch (\Throwable $e) {
            $this->error('    failed: '.$e->getMessage());
            $this->fetchAttempted[$ehPayRunId] = false;
            return;
        }

        $perEmpVerdict = [];
        if (is_array($payload) && isset($payload['earningsLines']) && is_array($payload['earningsLines'])) {
            foreach ($payload['earningsLines'] as $empId => $lines) {
                if (!is_array($lines) || empty($lines)) {
                    continue;
                }
                $isCasual = false;
                foreach ($lines as $line) {
                    $cat = $line['payCategoryName'] ?? $line['PayCategoryName'] ?? '';
                    if ($cat !== '' && stripos($cat, 'casual') !== false) {
                        $isCasual = true;
                        break;
                    }
                }
                $perEmpVerdict[(string) $empId] = $isCasual ? 'Casual' : 'Full Time';
            }
        }

        $this->verdicts[$ehPayRunId] = $perEmpVerdict;
        $this->fetchAttempted[$ehPayRunId] = true;
        // $payload goes out of scope here — raw lines freed.
    }
}
