<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drawing_measurements', function (Blueprint $table) {
            $table->foreignId('bid_area_id')->nullable()->after('takeoff_condition_id')->constrained('bid_areas')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('drawing_measurements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('bid_area_id');
        });
    }
};
