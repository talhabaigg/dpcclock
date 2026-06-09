<?php

namespace App\Console\Commands;

use App\Jobs\SyncTimesheetWithEH;
use App\Models\Clock;
use Illuminate\Console\Command;

class SyncTimesheets extends Command
{
    protected $signature = 'app:sync-timesheets';

    protected $description = 'Sync EH timesheets by triggering the /clocks/eh/sync endpoint';

    public function handle(): int
    {
        // Cheap existence check before dispatching — the scheduler fires every 15 minutes
        // and the queue worker was burning a job slot just to log "nothing to do" most runs.
        // Match the same predicate the job uses inside getClocksToSync(): unsynced clocks
        // with a clock_out (so we don't queue work for shifts still in progress).
        $pending = Clock::query()
            ->whereNull('eh_timesheet_id')
            ->whereNotNull('clock_out')
            ->where(fn ($q) => $q->whereNull('status')->orWhere('status', '!=', 'synced'))
            ->exists();

        if (! $pending) {
            // Silent skip — the scheduler hits this every 15 minutes and most runs have
            // nothing to do; logging would produce 96 noise lines/day with no signal.
            return self::SUCCESS;
        }

        SyncTimesheetWithEH::dispatch();

        return self::SUCCESS;
    }
}
