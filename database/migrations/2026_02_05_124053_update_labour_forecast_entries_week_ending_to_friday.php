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
        $driver = DB::getDriverName();

        if ($driver === 'sqlite') {
            DB::statement("UPDATE labour_forecast_entries SET week_ending = date(week_ending, '-2 days')");
        } else {
            DB::statement('UPDATE labour_forecast_entries SET week_ending = DATE_SUB(week_ending, INTERVAL 2 DAY)');
        }

        if (DB::getSchemaBuilder()->hasTable('turnover_forecast_entries')) {
            if ($driver === 'sqlite') {
                DB::statement("UPDATE turnover_forecast_entries SET week_ending = date(week_ending, '-2 days')");
            } else {
                DB::statement('UPDATE turnover_forecast_entries SET week_ending = DATE_SUB(week_ending, INTERVAL 2 DAY)');
            }
        }
    }

    /**
     * Reverse the migrations.
     *
     * Convert back from Friday to Sunday week endings by adding 2 days.
     */
    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'sqlite') {
            DB::statement("UPDATE labour_forecast_entries SET week_ending = date(week_ending, '+2 days')");
        } else {
            DB::statement('UPDATE labour_forecast_entries SET week_ending = DATE_ADD(week_ending, INTERVAL 2 DAY)');
        }

        if (DB::getSchemaBuilder()->hasTable('turnover_forecast_entries')) {
            if ($driver === 'sqlite') {
                DB::statement("UPDATE turnover_forecast_entries SET week_ending = date(week_ending, '+2 days')");
            } else {
                DB::statement('UPDATE turnover_forecast_entries SET week_ending = DATE_ADD(week_ending, INTERVAL 2 DAY)');
            }
        }
    }
};
