<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cash_forecast_general_costs', function (Blueprint $table) {
            $table->string('flow_type')->default('cash_out');
        });
    }

    public function down(): void
    {
        Schema::table('cash_forecast_general_costs', function (Blueprint $table) {
            $table->dropColumn('flow_type');
        });
    }
};
