<?php

namespace App\Jobs;

use App\Models\User;
use App\Notifications\KioskClockedInNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendKioskClockedInNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        // Example: Notify all users who clocked in today (customize as needed)
        $user = User::find(1); // Replace with actual user ID or logic to get the user
        $user->notify(new KioskClockedInNotification());

        // You can also loop through all users if needed
        // User::all()->each(function ($user) {
        //     $user->notify(new KioskClockedInNotification());
        // });
    }
}
