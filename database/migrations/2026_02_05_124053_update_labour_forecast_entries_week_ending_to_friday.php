<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Update all labour_forecast_entries week_ending dates from Sunday to Friday.
     * Since Sunday is 2 days after Friday, we subtract 2 days from each date.
     */
    public function up(): void
    {
        // Update labour_forecast_entries: subtract 2 days to convert Sunday -> Friday
        DB::statement('UPDATE labour_forecast_entries SET week_ending = DATE_SUB(week_ending, INTERVAL 2 DAY)');

        // Also update turnover_forecast_entries if they exist
        if (DB::getSchemaBuilder()->hasTable('turnover_forecast_entries')) {
            DB::statement('UPDATE turnover_forecast_entries SET week_ending = DATE_SUB(week_ending, INTERVAL 2 DAY)');
        }
    }

    /**
     * Reverse the migrations.
     *
     * Convert back from Friday to Sunday week endings by adding 2 days.
     */
    public function down(): void
    {
        // Add 2 days to convert Friday -> Sunday
        DB::statement('UPDATE labour_forecast_entries SET week_ending = DATE_ADD(week_ending, INTERVAL 2 DAY)');

        if (DB::getSchemaBuilder()->hasTable('turnover_forecast_entries')) {
            DB::statement('UPDATE turnover_forecast_entries SET week_ending = DATE_ADD(week_ending, INTERVAL 2 DAY)');
        }
    }
};
