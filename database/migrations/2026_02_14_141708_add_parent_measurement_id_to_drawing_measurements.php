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
        Schema::table('drawing_measurements', function (Blueprint $table) {
            if (!Schema::hasColumn('drawing_measurements', 'parent_measurement_id')) {
                $table->foreignId('parent_measurement_id')
                    ->nullable()
                    ->after('bid_area_id')
                    ->constrained('drawing_measurements')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('drawing_measurements', function (Blueprint $table) {
            if (Schema::hasColumn('drawing_measurements', 'parent_measurement_id')) {
                $table->dropConstrainedForeignId('parent_measurement_id');
            }
        });
    }
};
