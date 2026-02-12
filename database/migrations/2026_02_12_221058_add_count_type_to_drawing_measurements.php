<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            // SQLite stores type as TEXT already, no ENUM constraint to modify
            return;
        }

        DB::statement("ALTER TABLE drawing_measurements MODIFY COLUMN `type` ENUM('linear', 'area', 'count') NOT NULL");
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE drawing_measurements MODIFY COLUMN `type` ENUM('linear', 'area') NOT NULL");
    }
};
