<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('takeoff_conditions', 'pattern')) {
            DB::statement("ALTER TABLE takeoff_conditions MODIFY COLUMN pattern ENUM('none','solid','transparent','horizontal','vertical','backward_diagonal','forward_diagonal','crosshatch','diagonal_crosshatch') NOT NULL DEFAULT 'solid'");
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('takeoff_conditions', 'pattern')) {
            // Map new values back to old ones
            DB::statement("UPDATE takeoff_conditions SET pattern = 'solid' WHERE pattern NOT IN ('solid', 'dashed', 'dotted', 'dashdot')");
            DB::statement("ALTER TABLE takeoff_conditions MODIFY COLUMN pattern ENUM('solid','dashed','dotted','dashdot') NOT NULL DEFAULT 'solid'");
        }
    }
};
