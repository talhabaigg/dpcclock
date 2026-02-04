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
        Schema::table('location_pay_rate_templates', function (Blueprint $table) {
            // Toggle for whether leave markups (annual leave accrual + leave loading) are job costed
            // Default false = only oncosts are job costed for leave hours
            // True = both leave markups AND oncosts are job costed
            $table->boolean('leave_markups_job_costed')->default(false)->after('rdo_multistorey_allowance');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('location_pay_rate_templates', function (Blueprint $table) {
            $table->dropColumn('leave_markups_job_costed');
        });
    }
};
