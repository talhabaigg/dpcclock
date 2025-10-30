<?php

use App\Console\Commands\SendKioskClockedInNotification;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Console\Commands\SyncTimesheets;
use App\Console\Commands\BackupDatabase;


Schedule::command('app:sync-timesheets')
    ->everyFifteenMinutes()
    ->timezone('Australia/Brisbane');
Schedule::command('app:backup-database')->dailyAt('23:00')->timezone('Australia/Brisbane');
Schedule::command('app:send-kiosk-clocked-in-notification')->hourly()
    ->timezone('Australia/Brisbane')
    ->between('15:00', '17:30');