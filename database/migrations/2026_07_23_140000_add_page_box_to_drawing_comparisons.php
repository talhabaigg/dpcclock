<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('drawing_comparisons') && ! Schema::hasColumn('drawing_comparisons', 'page_width')) {
            Schema::table('drawing_comparisons', function (Blueprint $table) {
                // The sheet's page box in points, captured during analysis.
                //
                // Change geometry is stored in PDF points, but annotations are
                // normalised 0-1 against the page. Keeping the box here means
                // clouding a change later is arithmetic instead of another
                // download and probe of the source PDF.
                $table->float('page_width')->nullable()->after('text_comparable');
                $table->float('page_height')->nullable()->after('page_width');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('drawing_comparisons') && Schema::hasColumn('drawing_comparisons', 'page_width')) {
            Schema::table('drawing_comparisons', function (Blueprint $table) {
                $table->dropColumn(['page_width', 'page_height']);
            });
        }
    }
};
