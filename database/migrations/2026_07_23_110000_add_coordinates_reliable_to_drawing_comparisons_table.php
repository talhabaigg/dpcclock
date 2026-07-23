<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('drawing_comparisons') && ! Schema::hasColumn('drawing_comparisons', 'coordinates_reliable')) {
            Schema::table('drawing_comparisons', function (Blueprint $table) {
                // Whether the extracted text coordinates can be trusted as
                // absolute positions on the sheet.
                //
                // CAD exports frequently nest page content inside form XObjects
                // with their own transform, which the PHP text parser does not
                // fully resolve — an observed A1 sheet (2384 x 1684pt) reported
                // text spanning x -1121..5411. The diff is unaffected, because
                // both revisions are read in the same space and are registered
                // against each other, but "zoom to this change" would jump to
                // the wrong place. When this is false the UI lists changes
                // without offering to locate them.
                $table->boolean('coordinates_reliable')->default(false)->after('methods');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('drawing_comparisons') && Schema::hasColumn('drawing_comparisons', 'coordinates_reliable')) {
            Schema::table('drawing_comparisons', function (Blueprint $table) {
                $table->dropColumn('coordinates_reliable');
            });
        }
    }
};
