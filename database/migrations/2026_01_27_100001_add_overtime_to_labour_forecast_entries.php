<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('labour_forecast_entries', function (Blueprint $table) {
            // Change headcount from unsigned integer to decimal for fractional workers
            // (e.g., 0.4 for 2 days, 1.5 for 1.5 workers)
            $table->decimal('headcount', 5, 2)->default(0)->change();

            // Add overtime hours field (total overtime hours for this entry)
            $table->decimal('overtime_hours', 5, 2)->default(0)->after('headcount');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('labour_forecast_entries', function (Blueprint $table) {
            $table->dropColumn('overtime_hours');
            $table->unsignedInteger('headcount')->default(0)->change();
        });
    }
};
