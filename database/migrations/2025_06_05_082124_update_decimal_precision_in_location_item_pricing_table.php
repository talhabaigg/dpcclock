<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('location_item_pricing', function (Blueprint $table) {
            $table->decimal('unit_cost_override', 15, 6)->change();
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
    }
};
