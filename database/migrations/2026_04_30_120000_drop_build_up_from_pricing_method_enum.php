<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('takeoff_conditions', 'pricing_method')) {
            return;
        }

        DB::table('takeoff_conditions')
            ->where('pricing_method', 'build_up')
            ->update(['pricing_method' => 'detailed']);

        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE takeoff_conditions MODIFY pricing_method ENUM('unit_rate','detailed') NOT NULL DEFAULT 'detailed'");
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('takeoff_conditions', 'pricing_method') && DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE takeoff_conditions MODIFY pricing_method ENUM('unit_rate','build_up','detailed') NOT NULL DEFAULT 'build_up'");
        }
    }
};
