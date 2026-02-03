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
        // Update location_item_pricing pivot table
        Schema::table('location_item_pricing', function (Blueprint $table) {
            $table->decimal('unit_cost_override', 12, 6)->change();
        });

        // Update location_item_price_history table
        Schema::table('location_item_price_history', function (Blueprint $table) {
            $table->decimal('unit_cost_override', 12, 6)->change();
            $table->decimal('previous_unit_cost', 12, 6)->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('location_item_pricing', function (Blueprint $table) {
            $table->decimal('unit_cost_override', 10, 2)->change();
        });

        Schema::table('location_item_price_history', function (Blueprint $table) {
            $table->decimal('unit_cost_override', 10, 2)->change();
            $table->decimal('previous_unit_cost', 10, 2)->nullable()->change();
        });
    }
};
