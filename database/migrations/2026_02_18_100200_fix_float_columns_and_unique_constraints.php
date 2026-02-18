<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Fix float columns on ar_progress_billing_summaries — float causes rounding
        // errors on financial data; decimal(18,2) matches the rest of the table.
        Schema::table('ar_progress_billing_summaries', function (Blueprint $table) {
            $table->decimal('this_app_work_completed', 18, 2)->nullable()->change();
            $table->decimal('contract_sum_to_date', 18, 2)->nullable()->change();
        });

        // Ensure cash_forecast_settings is a true singleton — only one row allowed.
        // Add a 'singleton_key' column with a unique constraint so INSERT fails if row exists.
        if (! Schema::hasColumn('cash_forecast_settings', 'singleton_key')) {
            Schema::table('cash_forecast_settings', function (Blueprint $table) {
                $table->boolean('singleton_key')->default(true)->after('id');
                $table->unique('singleton_key');
            });
        }
    }

    public function down(): void
    {
        Schema::table('ar_progress_billing_summaries', function (Blueprint $table) {
            $table->float('this_app_work_completed')->nullable()->change();
            $table->float('contract_sum_to_date')->nullable()->change();
        });

        if (Schema::hasColumn('cash_forecast_settings', 'singleton_key')) {
            Schema::table('cash_forecast_settings', function (Blueprint $table) {
                $table->dropUnique(['singleton_key']);
                $table->dropColumn('singleton_key');
            });
        }
    }
};
