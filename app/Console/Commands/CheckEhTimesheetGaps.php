<?php

namespace App\Console\Commands;

use App\Services\EhTimesheetReconciliationService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class CheckEhTimesheetGaps extends Command
{
    protected $signature = 'app:check-eh-gaps
                            {--week= : Week-ending Friday (d-m-Y), defaults to last completed week}
                            {--weeks=1 : Number of past weeks to check (starting from --week and going backwards)}
                            {--location= : Filter to a single EH location id}
                            {--status= : Filter to a single timesheet status (e.g. Processed, Submitted). Applies to both EH and local.}
                            {--details : Print per-row detail for each gap/mismatch}
                            {--json= : Write a JSON report to this path}';

    protected $description = 'Read-only diff between local clocks and EH timesheets. Reports gaps and mismatches without changing anything.';

    public function handle(EhTimesheetReconciliationService $service): int
    {
        $tz = 'Australia/Brisbane';
        $startWeek = $this->option('week')
            ? Carbon::createFromFormat('d-m-Y', $this->option('week'), $tz)
            : Carbon::now($tz)->previous(Carbon::FRIDAY);

        $weeks = (int) $this->option('weeks');
        $locationFilter = $this->option('location');
        $statusFilter = $this->option('status');

        $allReports = [];
        $totalGaps = 0;
        for ($i = 0; $i < $weeks; $i++) {
            $weekEnding = $startWeek->copy()->subWeeks($i)->format('d-m-Y');
            $this->line('');
            $this->info("=== Week ending {$weekEnding} ===");
            $report = $service->diffWeek($weekEnding, $locationFilter, $statusFilter);
            $allReports[$weekEnding] = $report;

            $this->table(['Metric', 'Count'], [
                ['EH timesheets in window', $report['counts']['eh']],
                ['Local clocks in window', $report['counts']['local']],
                ['Matched', $report['counts']['matched']],
                ['Mismatched (field diffs)', $report['counts']['mismatched']],
                ['Local-only — never synced', $report['counts']['unsynced']],
                ['Local-only — had EH id but no match now', $report['counts']['orphaned']],
                ['EH-only — missing locally', $report['counts']['eh_only']],
                ['Clocks for archived employees', $report['counts']['archived_employee_clocks']],
            ]);

            $totalGaps += $report['counts']['mismatched']
                + $report['counts']['unsynced']
                + $report['counts']['orphaned']
                + $report['counts']['eh_only'];

            if ($this->option('details')) {
                $this->printDetails($report);
            }
        }

        if ($path = $this->option('json')) {
            file_put_contents($path, json_encode($allReports, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
            $this->info("Wrote JSON report to {$path}");
        }

        $this->line('');
        $this->info("Total gaps across all weeks: {$totalGaps}");

        return self::SUCCESS;
    }

    private function printDetails(array $report): void
    {
        if ($report['eh_only']) {
            $this->warn('EH-only rows (exist in EH, not locally):');
            $this->table(
                ['EH ID', 'Employee', 'Location', 'Start', 'End', 'Status'],
                array_map(fn ($r) => [$r['eh_id'], $r['employee_id'], $r['location_id'], $r['start_time'], $r['end_time'], $r['status']], $report['eh_only'])
            );
        }
        if ($report['unsynced']) {
            $this->warn('Local-only, never synced to EH:');
            $this->table(
                ['Clock ID', 'Employee', 'Location', 'Clock In', 'Clock Out', 'Incomplete'],
                array_map(fn ($r) => [$r['id'], $r['eh_employee_id'], $r['eh_location_id'], $r['clock_in'], $r['clock_out'], $r['incomplete'] ? 'Y' : ''], $report['unsynced'])
            );
        }
        if ($report['orphaned']) {
            $this->warn('Local-only, had EH id but not returned from EH now (possibly deleted in EH):');
            $this->table(
                ['Clock ID', 'EH Timesheet ID', 'Employee', 'Clock In', 'Clock Out'],
                array_map(fn ($r) => [$r['id'], $r['eh_timesheet_id'], $r['eh_employee_id'], $r['clock_in'], $r['clock_out']], $report['orphaned'])
            );
        }
        if ($report['mismatched']) {
            $this->warn('Field mismatches (local vs EH):');
            foreach ($report['mismatched'] as $m) {
                $this->line("  Clock #{$m['clock']['id']} / EH #{$m['eh']['eh_id']} (employee {$m['clock']['eh_employee_id']})");
                foreach ($m['diff'] as $field => $pair) {
                    $this->line("    - {$field}: local=".json_encode($pair['local']).' eh='.json_encode($pair['eh']));
                }
            }
        }
    }
}
