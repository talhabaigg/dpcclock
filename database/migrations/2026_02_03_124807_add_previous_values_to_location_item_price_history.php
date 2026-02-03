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
        Schema::table('location_item_price_history', function (Blueprint $table) {
            $table->decimal('previous_unit_cost', 10, 2)->nullable()->after('unit_cost_override');
            $table->boolean('previous_is_locked')->nullable()->after('is_locked');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('location_item_price_history', function (Blueprint $table) {
            $table->dropColumn(['previous_unit_cost', 'previous_is_locked']);
        });
    }
};
