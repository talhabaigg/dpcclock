<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('drawing_change_items') && ! Schema::hasColumn('drawing_change_items', 'locatable')) {
            Schema::table('drawing_change_items', function (Blueprint $table) {
                // Whether this row's coordinates are true page positions.
                //
                // Replaces the comparison-level flag added in Phase 1, because
                // the two detection methods differ: text-layer coordinates can
                // be in an unresolved nested space, while raster regions are
                // measured off the rendered page and are always correct. The
                // viewer offers "zoom to change" per row on this basis.
                $table->boolean('locatable')->default(false)->after('h');
            });

            // Backfill from the Phase 1 comparison-level flag so existing
            // cached comparisons keep behaving the same.
            DB::statement('
                UPDATE drawing_change_items i
                JOIN drawing_comparisons c ON c.id = i.drawing_comparison_id
                SET i.locatable = c.coordinates_reliable
            ');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('drawing_change_items') && Schema::hasColumn('drawing_change_items', 'locatable')) {
            Schema::table('drawing_change_items', function (Blueprint $table) {
                $table->dropColumn('locatable');
            });
        }
    }
};
