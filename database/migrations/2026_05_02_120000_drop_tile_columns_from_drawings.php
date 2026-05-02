<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('drawings')) {
            return;
        }

        // Drop the tiles_status index first if it still exists.
        $indexes = collect(DB::select(
            "SELECT INDEX_NAME FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drawings' AND COLUMN_NAME = 'tiles_status'"
        ))->pluck('INDEX_NAME')->unique();

        Schema::table('drawings', function (Blueprint $table) use ($indexes) {
            foreach ($indexes as $idx) {
                $table->dropIndex($idx);
            }
        });

        // Idempotently drop each obsolete tile-related column.
        foreach (['tiles_base_url', 'tiles_max_zoom', 'tile_size', 'tiles_status'] as $col) {
            if (Schema::hasColumn('drawings', $col)) {
                Schema::table('drawings', function (Blueprint $table) use ($col) {
                    $table->dropColumn($col);
                });
            }
        }

        // tiles_width and tiles_height are intentionally kept — they store the
        // source PDF render dimensions used by DrawingMeasurementController for
        // normalized→real coordinate math. The misnomer is acknowledged.
    }

    public function down(): void
    {
        if (! Schema::hasTable('drawings')) {
            return;
        }

        Schema::table('drawings', function (Blueprint $table) {
            if (! Schema::hasColumn('drawings', 'tiles_base_url')) {
                $table->string('tiles_base_url')->nullable();
            }
            if (! Schema::hasColumn('drawings', 'tiles_max_zoom')) {
                $table->unsignedTinyInteger('tiles_max_zoom')->nullable();
            }
            if (! Schema::hasColumn('drawings', 'tile_size')) {
                $table->unsignedSmallInteger('tile_size')->default(256);
            }
            if (! Schema::hasColumn('drawings', 'tiles_status')) {
                $table->string('tiles_status', 20)->nullable()->index();
            }
        });
    }
};
