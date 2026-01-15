<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('job_forecast_data', function (Blueprint $table) {
            // Drop the existing unique constraint
            $table->dropUnique('unique_forecast_entry');

            // Add a new unique constraint including job_forecast_id
            $table->unique(['job_forecast_id', 'grid_type', 'cost_item', 'month'], 'unique_forecast_entry_v2');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('job_forecast_data', function (Blueprint $table) {
            // Drop the new unique constraint
            $table->dropUnique('unique_forecast_entry_v2');

            // Re-add the old unique constraint
            $table->unique(['job_number', 'grid_type', 'cost_item', 'month'], 'unique_forecast_entry');
        });
    }
};
