<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE drawing_measurements MODIFY COLUMN `type` ENUM('linear', 'area', 'count') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE drawing_measurements MODIFY COLUMN `type` ENUM('linear', 'area') NOT NULL");
    }
};
