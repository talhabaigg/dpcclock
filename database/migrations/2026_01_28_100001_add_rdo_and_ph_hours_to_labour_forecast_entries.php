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
        Schema::table('labour_forecast_entries', function (Blueprint $table) {
            $table->decimal('rdo_hours', 5, 2)->default(0)->after('leave_hours');
            $table->decimal('public_holiday_not_worked_hours', 5, 2)->default(0)->after('rdo_hours');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('labour_forecast_entries', function (Blueprint $table) {
            $table->dropColumn(['rdo_hours', 'public_holiday_not_worked_hours']);
        });
    }
};
