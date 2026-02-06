<?php

namespace App\Console\Commands;

use App\Jobs\SyncTimesheetWithEH;
use Illuminate\Console\Command; // Import your job here

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
