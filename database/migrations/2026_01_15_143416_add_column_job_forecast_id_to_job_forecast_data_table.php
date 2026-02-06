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
        Schema::table('job_forecast_data', function (Blueprint $table) {
            $table->foreignId('job_forecast_id')->nullable()->constrained('job_forecasts')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('job_forecast_data', function (Blueprint $table) {
            $table->dropForeign(['job_forecast_id']);
            $table->dropColumn('job_forecast_id');
        });
    }
};
