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
        Schema::table('kiosks', function (Blueprint $table) {
            $table->boolean('laser_allowance_enabled')->default(true);
            $table->boolean('insulation_allowance_enabled')->default(true);
            $table->boolean('setout_allowance_enabled')->default(true);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kiosks', function (Blueprint $table) {
            $table->dropColumn('laser_allowance_enabled');
            $table->dropColumn('insulation_allowance_enabled');
            $table->dropColumn('setout_allowance_enabled');
        });
    }
};
