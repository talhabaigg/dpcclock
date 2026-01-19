<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cash_forecast_settings', function (Blueprint $table) {
            $table->unsignedTinyInteger('gst_q1_pay_month')->default(4);
            $table->unsignedTinyInteger('gst_q2_pay_month')->default(8);
            $table->unsignedTinyInteger('gst_q3_pay_month')->default(11);
            $table->unsignedTinyInteger('gst_q4_pay_month')->default(2);
        });
    }

    public function down(): void
    {
        Schema::table('cash_forecast_settings', function (Blueprint $table) {
            $table->dropColumn([
                'gst_q1_pay_month',
                'gst_q2_pay_month',
                'gst_q3_pay_month',
                'gst_q4_pay_month',
            ]);
        });
    }
};
