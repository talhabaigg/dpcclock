<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cash_forecast_settings', function (Blueprint $table) {
            $table->decimal('gst_rate', 5, 4)->default(0.1000)->after('gst_q4_pay_month');
            $table->decimal('wage_tax_ratio', 5, 4)->default(0.3000)->after('gst_rate');
            $table->decimal('default_retention_rate', 5, 4)->default(0.0500)->after('wage_tax_ratio');
            $table->decimal('default_retention_cap_pct', 5, 4)->default(0.0500)->after('default_retention_rate');
        });
    }

    public function down(): void
    {
        Schema::table('cash_forecast_settings', function (Blueprint $table) {
            $table->dropColumn(['gst_rate', 'wage_tax_ratio', 'default_retention_rate', 'default_retention_cap_pct']);
        });
    }
};
