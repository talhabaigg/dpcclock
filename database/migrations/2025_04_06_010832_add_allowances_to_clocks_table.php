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
        Schema::table('clocks', function (Blueprint $table) {
            $table->boolean('laser_allowance')->nullable()->default(false);
            $table->boolean('insulation_allowance')->nullable()->default(false);
            $table->boolean('setout_allowance')->nullable()->default(false);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('clocks', function (Blueprint $table) {
            $table->dropColumn('laser_allowance');
            $table->dropColumn('insulation_allowance');
            $table->dropColumn('setout_allowance');
        });
    }
};
