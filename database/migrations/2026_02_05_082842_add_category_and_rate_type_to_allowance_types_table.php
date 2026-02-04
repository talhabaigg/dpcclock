<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('allowance_types', function (Blueprint $table) {
            // Category for grouping: fares_travel, site, multistorey, custom
            $table->string('category')->default('custom')->after('code');
            // Default rate type: hourly, daily, weekly
            $table->string('default_rate_type')->default('hourly')->after('default_rate');
            // Reference to pay_category_id for fetching rates from KeyPay templates
            $table->unsignedBigInteger('pay_category_id')->nullable()->after('default_rate_type');
        });

        // Update existing allowances to be categorized as 'custom'
        DB::table('allowance_types')->update(['category' => 'custom']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('allowance_types', function (Blueprint $table) {
            $table->dropColumn(['category', 'default_rate_type', 'pay_category_id']);
        });
    }
};
