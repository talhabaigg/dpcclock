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
            $table->decimal('waste_ratio', 5, 2)->nullable();
            $table->string('prelim_type')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('location_cost_codes', function (Blueprint $table) {
            $table->dropColumn('waste_ratio');
            $table->dropColumn('prelim_type');
        });
    }
};
