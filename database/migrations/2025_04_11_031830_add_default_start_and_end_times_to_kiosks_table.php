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
            $table->time('default_start_time')->nullable()->default('06:30:00');
            $table->time('default_end_time')->nullable()->after('default_start_time')->default('14:30:00');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kiosks', function (Blueprint $table) {
            $table->dropColumn('default_start_time');
            $table->dropColumn('default_end_time');
        });
    }
};
