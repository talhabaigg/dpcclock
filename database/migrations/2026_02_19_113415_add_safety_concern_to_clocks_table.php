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
            $table->boolean('safety_concern')->nullable()->after('setout_allowance');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('clocks', function (Blueprint $table) {
            $table->dropColumn('safety_concern');
        });
    }
};
