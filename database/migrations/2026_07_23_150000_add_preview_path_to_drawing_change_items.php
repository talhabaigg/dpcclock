<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('drawing_change_items') && ! Schema::hasColumn('drawing_change_items', 'preview_path')) {
            Schema::table('drawing_change_items', function (Blueprint $table) {
                // Relative path to an animated before/after GIF of this region,
                // on the local disk. Toggling between the two revisions in place
                // is how a person actually reads a drawing change — far quicker
                // than parsing a written description of it.
                $table->string('preview_path')->nullable()->after('h');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('drawing_change_items') && Schema::hasColumn('drawing_change_items', 'preview_path')) {
            Schema::table('drawing_change_items', function (Blueprint $table) {
                $table->dropColumn('preview_path');
            });
        }
    }
};
