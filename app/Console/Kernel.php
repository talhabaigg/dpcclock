<?php

namespace App\Console;

use App\Jobs\LoadApPostedInvoiceLines;
use App\Jobs\LoadApPostedInvoices;
use App\Jobs\LoadArPostedInvoices;
use App\Jobs\LoadArProgressBillingSummaries;
use App\Jobs\LoadJobCostData;
use App\Jobs\LoadJobReportByCostItemAndCostTypes;
use App\Jobs\LoadJobSummaries;
use App\Jobs\LoadJobVendorCommitments;
use App\Jobs\LoadTimesheetsFromEH;
use Carbon\Carbon;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        // Premier Data Syncs - Daily
        $schedule->job(LoadJobSummaries::class)
            ->dailyAt('05:00')
            ->withoutOverlapping()
            ->runInBackground();

        $schedule->job(LoadJobCostData::class)
             ->dailyAt('05:00')
            ->withoutOverlapping()
            ->runInBackground();

        $schedule->job(LoadApPostedInvoices::class)
             ->dailyAt('05:00')
            ->withoutOverlapping()
            ->runInBackground();

        $schedule->job(LoadApPostedInvoiceLines::class)
            ->dailyAt('05:00')
            ->withoutOverlapping()
            ->runInBackground();

        // Premier Data Syncs - Weekly
        $schedule->job(LoadJobReportByCostItemAndCostTypes::class)
            ->weeklyOn(1, '05:00')  // Monday at 5:00 AM
            ->withoutOverlapping()
            ->runInBackground();

        // Premier Data Syncs - Monthly
        $schedule->job(LoadArProgressBillingSummaries::class)
            ->monthlyOn(10, '05:00')  // 10th of month at 5:00 AM
            ->withoutOverlapping()
            ->runInBackground();

        $schedule->job(LoadArPostedInvoices::class)
            ->monthlyOn(10, '05:00')  // 10th of month at 5:00 AM
            ->withoutOverlapping()
            ->runInBackground();

        $schedule->job(LoadJobVendorCommitments::class)
            ->monthlyOn(10, '05:00')  // 10th of month at 5:00 AM
            ->withoutOverlapping()
            ->runInBackground();

        // Employment Hero Timesheet Sync - Daily
        $schedule->call(function () {
            $tz = 'Australia/Brisbane';
            $weekEnding = Carbon::now($tz)->endOfWeek(Carbon::FRIDAY)->format('d-m-Y');
            dispatch(new LoadTimesheetsFromEH($weekEnding));
        })
            ->dailyAt('05:00')
            ->withoutOverlapping()
            ->runInBackground();
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
