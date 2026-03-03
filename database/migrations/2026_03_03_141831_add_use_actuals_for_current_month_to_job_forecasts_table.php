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
        Schema::table('job_forecasts', function (Blueprint $table) {
            $table->boolean('use_actuals_for_current_month')->default(false)->after('is_locked');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('job_forecasts', function (Blueprint $table) {
            $table->dropColumn('use_actuals_for_current_month');
        });
    }
};
