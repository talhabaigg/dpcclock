<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Jobs\SyncTimesheetWithEH; // Import your job here

class SyncTimesheets extends Command
{
    protected $signature = 'app:sync-timesheets';

    protected $description = 'Sync EH timesheets by triggering the /clocks/eh/sync endpoint';

    public function handle()
    {
        // Dispatch the job
        SyncTimesheetWithEH::dispatch();

        $this->info('SyncTimesheetWithEH job dispatched.');
    }
}
