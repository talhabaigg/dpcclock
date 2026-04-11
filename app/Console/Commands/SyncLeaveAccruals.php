<?php

namespace App\Console\Commands;

use App\Models\PayRun;
use App\Models\PayRunLeaveAccrual;
use App\Services\EmploymentHeroService;
use Illuminate\Console\Command;

class SyncLeaveAccruals extends Command
{
    protected $signature = 'app:sync-leave-accruals
        {--from= : Start date (Y-m-d), defaults to 6 months ago}
        {--to= : End date (Y-m-d), defaults to today}
        {--force : Re-sync already synced pay runs}';

    protected $description = 'Sync leave accruals from Employment Hero pay runs';

    public function handle(EmploymentHeroService $ehService): int
    {
        $from = $this->option('from') ?? now()->subMonths(6)->format('Y-m-d');
        $to = $this->option('to') ?? now()->format('Y-m-d');
        $force = $this->option('force');

        $this->info("Fetching pay runs from {$from} to {$to}...");

        try {
            $payRuns = $ehService->getPayRuns($from, $to);
        } catch (\Throwable $e) {
            $this->error('Failed to fetch pay runs: '.$e->getMessage());
            return self::FAILURE;
        }

        $this->info('Found '.count($payRuns).' pay runs.');

        $synced = 0;
        $skipped = 0;

        foreach ($payRuns as $payRunData) {
            $ehPayRunId = $payRunData['id'] ?? null;
            if (!$ehPayRunId) continue;

            // Upsert the pay run record
            $payRun = PayRun::updateOrCreate(
                ['eh_pay_run_id' => $ehPayRunId],
                [
                    'pay_period_starting' => $payRunData['payPeriodStarting'] ?? $payRunData['payPeriodStart'] ?? null,
                    'pay_period_ending' => $payRunData['payPeriodEnding'] ?? $payRunData['payPeriodEnd'] ?? null,
                    'date_paid' => $payRunData['datePaid'] ?? $payRunData['paymentDate'] ?? null,
                    'status' => $payRunData['status'] ?? null,
                ],
            );

            // Skip if already synced (unless --force)
            if ($payRun->leave_accruals_synced && !$force) {
                $skipped++;
                continue;
            }

            try {
                $response = $ehService->getLeaveAccruals($ehPayRunId, true);
            } catch (\Throwable $e) {
                $this->warn("Failed to fetch accruals for pay run {$ehPayRunId}: ".$e->getMessage());
                continue;
            }

            // The response has { leave: { employeeId: [ accruals ] }, payRunId }
            $leaveData = $response['leave'] ?? [];

            // Clear existing accruals for this pay run before re-importing
            $payRun->leaveAccruals()->delete();

            $accrualRecords = [];
            $now = now();
            foreach ($leaveData as $employeeId => $accruals) {
                foreach ($accruals as $accrual) {
                    $accrualRecords[] = [
                        'pay_run_id' => $payRun->id,
                        'eh_employee_id' => $employeeId,
                        'leave_category_id' => $accrual['leaveCategoryId'] ?? null,
                        'leave_category_name' => $accrual['leaveCategoryName'] ?? null,
                        'accrual_type' => $accrual['accrualType'] ?? null,
                        'amount' => $accrual['amount'] ?? 0,
                        'notes' => $accrual['notes'] ?? null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }

            // Bulk insert
            foreach (array_chunk($accrualRecords, 500) as $chunk) {
                PayRunLeaveAccrual::insert($chunk);
            }

            $payRun->update(['leave_accruals_synced' => true]);
            $synced++;

            $this->line("  Pay run {$ehPayRunId} ({$payRun->pay_period_ending?->format('d M Y')}): ".count($accrualRecords).' accruals');
        }

        $this->info("Done. Synced: {$synced}, Skipped: {$skipped}");

        return self::SUCCESS;
    }
}
