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
            // Add nullable forecast_project_id to support forecast-only projects
            $table->foreignId('forecast_project_id')->nullable()->after('location_id')->constrained()->onDelete('cascade');

            // Make location_id nullable since forecast projects don't have a real location
            $table->unsignedBigInteger('location_id')->nullable()->change();

            // Make job_number nullable for forecast projects
            $table->string('job_number')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('job_forecast_data', function (Blueprint $table) {
            $table->dropForeign(['forecast_project_id']);
            $table->dropColumn('forecast_project_id');

            // Restore original constraints
            $table->unsignedBigInteger('location_id')->nullable(false)->change();
            $table->string('job_number')->nullable(false)->change();
        });
    }
};
