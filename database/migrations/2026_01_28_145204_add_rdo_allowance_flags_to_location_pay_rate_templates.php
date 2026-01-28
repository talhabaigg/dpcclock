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
            // Add flags to control which standard allowances are paid during RDO
            $table->boolean('rdo_fares_travel')->default(true)->after('cost_code_prefix');
            $table->boolean('rdo_site_allowance')->default(false)->after('rdo_fares_travel');
            $table->boolean('rdo_multistorey_allowance')->default(false)->after('rdo_site_allowance');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('location_pay_rate_templates', function (Blueprint $table) {
            $table->dropColumn(['rdo_fares_travel', 'rdo_site_allowance', 'rdo_multistorey_allowance']);
        });
    }
};
