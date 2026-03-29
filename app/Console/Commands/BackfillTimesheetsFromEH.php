<?php

namespace App\Console\Commands;

use App\Jobs\LoadTimesheetsFromEH;
use Carbon\Carbon;
use Illuminate\Console\Command;

class BackfillTimesheetsFromEH extends Command
{
    protected $signature = 'app:backfill-timesheets-from-eh
                            {--from= : Start date (d-m-Y), defaults to 12-05-2025}
                            {--to= : End date (d-m-Y), defaults to today}
                            {--sync : Run synchronously instead of dispatching to queue}';

    protected $description = 'Backfill EH timesheet IDs by loading timesheets for each past week';

    public function handle(): void
    {
        $tz = 'Australia/Brisbane';
        $from = $this->option('from')
            ? Carbon::createFromFormat('d-m-Y', $this->option('from'), $tz)
            : Carbon::parse('2025-05-12', $tz);

        $to = $this->option('to')
            ? Carbon::createFromFormat('d-m-Y', $this->option('to'), $tz)
            : Carbon::now($tz);

        // Find the first Friday on or after the start date
        $friday = $from->copy()->is(Carbon::FRIDAY)
            ? $from->copy()
            : $from->copy()->next(Carbon::FRIDAY);

        $weeks = [];
        while ($friday->lte($to)) {
            $weeks[] = $friday->format('d-m-Y');
            $friday->addWeek();
        }

        $this->info("Will process " . count($weeks) . " weeks from {$from->format('d-m-Y')} to {$to->format('d-m-Y')}");

        $bar = $this->output->createProgressBar(count($weeks));
        $bar->start();

        foreach ($weeks as $weekEnding) {
            if ($this->option('sync')) {
                (new LoadTimesheetsFromEH($weekEnding))->handle();
            } else {
                dispatch(new LoadTimesheetsFromEH($weekEnding));
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info('Done. ' . count($weeks) . ' weeks ' . ($this->option('sync') ? 'processed.' : 'dispatched to queue.'));
    }
}
