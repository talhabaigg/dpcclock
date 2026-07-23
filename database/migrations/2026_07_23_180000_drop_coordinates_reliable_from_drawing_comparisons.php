<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Removes a sheet-wide "can text be located" flag that per-change data replaced.
     *
     * The flag existed because the extraction's overall extent looked like it
     * ran far off the page, which was read as the text coordinates being in
     * some other space. They were not — the extent is built from x plus an
     * estimated text width, and one long string is enough to inflate it. Each
     * change now carries its own locatable flag, measured where it actually
     * sits, so the sheet-wide verdict has nothing left to decide.
     */
    public function up(): void
    {
        if (Schema::hasTable('drawing_comparisons') && Schema::hasColumn('drawing_comparisons', 'coordinates_reliable')) {
            Schema::table('drawing_comparisons', function (Blueprint $table) {
                $table->dropColumn('coordinates_reliable');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('drawing_comparisons') && ! Schema::hasColumn('drawing_comparisons', 'coordinates_reliable')) {
            Schema::table('drawing_comparisons', function (Blueprint $table) {
                $table->boolean('coordinates_reliable')->default(true)->after('methods');
            });
        }
    }
};
