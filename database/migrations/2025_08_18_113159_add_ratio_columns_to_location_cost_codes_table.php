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
        Schema::table('location_cost_codes', function (Blueprint $table) {
            $table->decimal('variation_ratio', 5, 2)->nullable();
            $table->decimal('dayworks_ratio', 5, 2)->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('location_cost_codes', function (Blueprint $table) {
            $table->dropColumn('variation_ratio');
            $table->dropColumn('dayworks_ratio');
        });
    }
};
