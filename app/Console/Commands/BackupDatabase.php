<?php

namespace App\Console\Commands;

use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class BackupDatabase extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:backup-database';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Backup MySQL database and upload to S3';

    /**
     * Execute the console command.
     *
     * @return void
     */
    public function handle()
    {
        $date = Carbon::now()->format('Y-m-d_H-i-s');
        $backupFileName = "db_backup_{$date}.sql";
        $backupFilePath = storage_path("app/{$backupFileName}");

        $dbHost = config('database.connections.mysql.host');
        $dbPort = config('database.connections.mysql.port');
        $dbUser = config('database.connections.mysql.username');
        $dbPass = config('database.connections.mysql.password');
        $dbName = config('database.connections.mysql.database');

        // Build the mysqldump command
        $command = "mysqldump -h{$dbHost} -P{$dbPort} -u{$dbUser} -p\"{$dbPass}\" {$dbName} > {$backupFilePath}";

        // Execute the command
        $result = null;
        $output = null;
        exec($command, $output, $result);

        if ($result !== 0) {
            $this->error('Database backup failed.');

            return;
        }

        // Upload to S3
        $uploaded = Storage::disk('s3')->put("backups/{$backupFileName}", fopen($backupFilePath, 'r'));

        if ($uploaded) {
            $this->info('Database backup uploaded successfully to S3!');
        } else {
            $this->error('Failed to upload the backup to S3.');
        }

        // Optionally delete the local copy
        unlink($backupFilePath);
    }
}
