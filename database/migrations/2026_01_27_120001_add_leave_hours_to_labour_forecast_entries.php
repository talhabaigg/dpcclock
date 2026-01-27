<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds leave_hours field for forecasting periods when workers are on leave.
     * When workers are on leave:
     * - Wages are paid from accruals (not job costed)
     * - Oncosts (super, BERT, BEWT, CIPQ, payroll tax, workcover) ARE still job costed
     *
     * This allows forecasting the oncost impact of planned leave.
     */
    public function up(): void
    {
        Schema::table('labour_forecast_entries', function (Blueprint $table) {
            $table->decimal('leave_hours', 5, 2)->default(0)->after('overtime_hours');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('labour_forecast_entries', function (Blueprint $table) {
            $table->dropColumn('leave_hours');
        });
    }
};
