<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SyncTimesheets extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:sync-timesheets';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Command description';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $url = config('app.url') . '/clocks/eh/sync';

        $response = Http::get($url);

        if ($response->successful()) {
            $message = "✅ Triggered /clocks/eh/sync: Success";
            $this->info($message);
            Log::info($message);
        } else {
            $message = "❌ Failed to trigger /clocks/eh/sync. Status: " . $response->status();
            $this->error($message);
            Log::error($message);
        }
        return 0;
    }
}
