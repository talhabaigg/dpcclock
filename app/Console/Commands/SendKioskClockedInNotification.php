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
        $user = User::find(1); // Replace with actual user ID or logic to get the user
        $employees = Employee::whereHas('clocks', function ($query) {
            $query->whereNull('clock_out');
        })
            ->with([
                'clocks' => function ($query) {
                    $query->whereNull('clock_out');
                }
            ])
            ->get();
        Log::info('Employees clocked in: ', $employees->toArray());


        $user->notify(new KioskClockedInNotification($employees->toArray()));
    }
}
