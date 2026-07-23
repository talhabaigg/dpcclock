<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('drawing_change_items') && ! Schema::hasColumn('drawing_change_items', 'count_old')) {
            Schema::table('drawing_change_items', function (Blueprint $table) {
                // Population counts for rows that stand in for many instances:
                // "PT04 tags: 22 -> 19", or "14 dimensions revised in this area".
                // Null on rows describing a single specific change.
                $table->unsignedSmallInteger('count_old')->nullable()->after('text_new');
                $table->unsignedSmallInteger('count_new')->nullable()->after('count_old');
            });
        }

        if (Schema::hasTable('drawing_comparisons')) {
            Schema::table('drawing_comparisons', function (Blueprint $table) {
                if (! Schema::hasColumn('drawing_comparisons', 'pipeline_version')) {
                    // A comparison is cached forever on the revision pair, which
                    // is right while the algorithm is fixed and wrong the moment
                    // it changes: without this, improvements never reach any
                    // sheet a user has already opened. Bumping the constant in
                    // DrawingComparisonService re-runs stale rows on next view.
                    $table->unsignedSmallInteger('pipeline_version')->default(0)->after('methods');
                }

                if (! Schema::hasColumn('drawing_comparisons', 'text_comparable')) {
                    // False when the two PDFs split their text into runs so
                    // differently that a token-level diff is not trustworthy —
                    // different CAD exporters do this, and it manufactures
                    // hundreds of phantom changes. Raster detection is
                    // unaffected, since pixels do not care how text is encoded.
                    $table->boolean('text_comparable')->default(true)->after('pipeline_version');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('drawing_change_items') && Schema::hasColumn('drawing_change_items', 'count_old')) {
            Schema::table('drawing_change_items', function (Blueprint $table) {
                $table->dropColumn(['count_old', 'count_new']);
            });
        }

        if (Schema::hasTable('drawing_comparisons')) {
            Schema::table('drawing_comparisons', function (Blueprint $table) {
                foreach (['pipeline_version', 'text_comparable'] as $column) {
                    if (Schema::hasColumn('drawing_comparisons', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};
