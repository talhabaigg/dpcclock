<?php

use App\Jobs\LoadApPostedInvoiceLines;
use App\Jobs\LoadApPostedInvoices;
use App\Jobs\LoadApPurchaseOrders;
use App\Jobs\LoadArPostedInvoices;
use App\Jobs\LoadArProgressBillingSummaries;
use App\Jobs\LoadJobCostData;
use App\Jobs\LoadJobReportByCostItemAndCostTypes;
use App\Jobs\LoadJobSummaries;
use App\Jobs\LoadJobVendorCommitments;
use App\Jobs\LoadTimesheetsFromEH;
use App\Models\QueueJobLog;
use Carbon\Carbon;

// Clean up queue job logs older than 24 hours
Schedule::call(function () {
    QueueJobLog::where('logged_at', '<', now()->subHours(24))->delete();
})->hourly();

Schedule::command('app:sync-timesheets')
    ->everyFifteenMinutes()
    ->timezone('Australia/Brisbane');
Schedule::command('app:backup-database')->dailyAt('23:00')->timezone('Australia/Brisbane');
Schedule::command('app:send-kiosk-clocked-in-notification')->hourly()
    ->timezone('Australia/Brisbane')
    ->between('15:00', '17:30');

// Premier Data Syncs - Daily
Schedule::job(LoadJobSummaries::class)
    ->dailyAt('05:00')
    ->withoutOverlapping();

Schedule::job(LoadJobCostData::class)
    ->dailyAt('05:00')
    ->withoutOverlapping();

Schedule::job(LoadApPostedInvoices::class)
    ->dailyAt('05:00')
    ->withoutOverlapping();

Schedule::job(LoadApPostedInvoiceLines::class)
    ->dailyAt('05:00')
    ->withoutOverlapping();

Schedule::job(LoadApPurchaseOrders::class)
    ->dailyAt('05:00')
    ->withoutOverlapping();

// Premier Data Syncs - Weekly
Schedule::job(LoadJobReportByCostItemAndCostTypes::class)
    ->weeklyOn(1, '05:00')  // Monday at 5:00 AM
    ->withoutOverlapping();

// Premier Data Syncs - Monthly
Schedule::job(LoadArProgressBillingSummaries::class)
    ->monthlyOn(10, '05:00')  // 10th of month at 5:00 AM
    ->withoutOverlapping();

Schedule::job(LoadArPostedInvoices::class)
    ->monthlyOn(10, '05:00')  // 10th of month at 5:00 AM
    ->withoutOverlapping();

Schedule::job(LoadJobVendorCommitments::class)
    ->monthlyOn(10, '05:00')  // 10th of month at 5:00 AM
    ->withoutOverlapping();

// Employment Hero Timesheet Sync - Daily
Schedule::call(function () {
    $tz = 'Australia/Brisbane';
    $now = Carbon::now($tz);
    if ($now->isFriday()) {
        $weekEnding = $now->copy();
    } elseif ($now->isWeekend()) {
        $weekEnding = $now->copy()->previous(Carbon::FRIDAY);
    } else {
        $weekEnding = $now->copy()->endOfWeek(Carbon::FRIDAY);
    }
    dispatch(new LoadTimesheetsFromEH($weekEnding->format('d-m-Y')));
})
    ->name('load-timesheets-from-eh')
    ->dailyAt('05:00')
    ->withoutOverlapping();
