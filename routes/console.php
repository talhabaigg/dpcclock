<?php

use App\Models\QueueJobLog;

// Clean up queue job logs older than 24 hours
Schedule::call(function () {
    QueueJobLog::where('logged_at', '<', now()->subHours(24))->delete();
})->hourly();

Schedule::command('app:sync-timesheets')
    ->everyFifteenMinutes()
    ->timezone('Australia/Brisbane');
Schedule::command('app:backup-database')->dailyAt('23:00')->timezone('Australia/Brisbane');
Schedule::command('app:send-kiosk-clocked-in-notification')->hourly()
    ->timezone('Australia/Brisbane')
    ->between('15:00', '17:30');
