<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Notifications\KioskClockedInNotification;
use App\Models\Employee;
use App\Models\Kiosk;
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

        // Iterate over each kiosk
        foreach ($kiosks as $kiosk) {
            // Retrieve employees from the current kiosk that are clocked in
            $employees = $kiosk->employees()->whereHas('clocks', function ($query) use ($kiosk) {
                $query->whereNull('clock_out')
                    ->where('eh_kiosk_id', $kiosk->eh_kiosk_id); // Ensure the clock belongs to this kiosk
            })
                ->with([
                    'clocks' => function ($query) use ($kiosk) {
                        $query->whereNull('clock_out')
                            ->where('eh_kiosk_id', $kiosk->eh_kiosk_id); // Ensure the clock belongs to this kiosk
                    }
                ])
                ->get();

            // Check if there are any employees clocked in
            if ($employees->isNotEmpty()) {
                Log::info("Employees clocked in for kiosk {$kiosk->id}: ", $employees->toArray());

                // Send notification to each manager of the kiosk
                foreach ($kiosk->managers as $manager) {
                    $manager->notify(new KioskClockedInNotification($employees->toArray(), $kiosk->name));
                }
            } else {
                Log::info("No employees clocked in for kiosk {$kiosk->id}.");
            }
        }
    }
}
