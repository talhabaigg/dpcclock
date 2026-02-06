<?php

namespace App\Console\Commands;

use App\Models\Kiosk;
use App\Notifications\KioskClockedInNotification;
use Illuminate\Console\Command;
use Log;

class SendKioskClockedInNotification extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:send-kiosk-clocked-in-notification';

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
        // Retrieve all kiosks
        $kiosks = Kiosk::all();

        $today = now()->startOfDay();

        // Iterate over each kiosk
        foreach ($kiosks as $kiosk) {
            // Retrieve employees from the current kiosk that are clocked in TODAY only
            $employees = $kiosk->employees()->whereHas('clocks', function ($query) use ($kiosk, $today) {
                $query->whereNull('clock_out')
                    ->where('eh_kiosk_id', $kiosk->eh_kiosk_id)
                    ->whereDate('clock_in', $today); // Only include clocks from today
            })
                ->with([
                    'clocks' => function ($query) use ($kiosk, $today) {
                        $query->whereNull('clock_out')
                            ->where('eh_kiosk_id', $kiosk->eh_kiosk_id)
                            ->whereDate('clock_in', $today); // Only include clocks from today
                    },
                ])
                ->get();

            // Check if there are any employees clocked in
            if ($employees->isNotEmpty()) {
                Log::info("Employees clocked in for kiosk {$kiosk->id}: ", $employees->toArray());

                // Send notification to each manager of the kiosk (skip if disabled)
                foreach ($kiosk->managers as $manager) {
                    if ($manager->disable_kiosk_notifications) {
                        Log::info("Skipping notification for manager {$manager->id} - notifications disabled.");

                        continue;
                    }
                    $manager->notify(new KioskClockedInNotification($employees->toArray(), $kiosk->name));
                }
            } else {
                Log::info("No employees clocked in for kiosk {$kiosk->id}.");
            }
        }
    }
}
