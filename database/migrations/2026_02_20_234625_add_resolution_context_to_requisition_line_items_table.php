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
        Schema::table('requisition_line_items', function (Blueprint $table) {
            if (! Schema::hasColumn('requisition_line_items', 'resolution_context')) {
                $table->json('resolution_context')->nullable()->after('is_locked');
            }
        });
    }

    public function down(): void
    {
        Schema::table('requisition_line_items', function (Blueprint $table) {
            if (Schema::hasColumn('requisition_line_items', 'resolution_context')) {
                $table->dropColumn('resolution_context');
            }
        });
    }
};
