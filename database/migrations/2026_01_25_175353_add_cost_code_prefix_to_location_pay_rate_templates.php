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
            $table->string('cost_code_prefix', 10)->nullable()->after('hourly_rate');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('location_pay_rate_templates', function (Blueprint $table) {
            $table->dropColumn('cost_code_prefix');
        });
    }
};
