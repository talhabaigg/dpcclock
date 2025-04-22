<?php

use App\Console\Commands\SendKioskClockedInNotification;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Console\Commands\SyncTimesheets;


// Schedule::command(SyncTimesheets::class)
//     ->everyMinute()
//     ->timezone('Australia/Brisbane');

Schedule::command('app:send-kiosk-clocked-in-notification')->hourly()
    ->timezone('Australia/Brisbane');
// ->between('15:00', '17:30');