<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     *
     * Add project_id to drawing_sheets to support project-level grouping.
     * This allows sheets from drawing sets (bulk PDF uploads) to be grouped
     * by drawing_number across the entire project, not just within a QA stage.
     */
    public function up(): void
    {
        Schema::table('drawing_sheets', function (Blueprint $table) {
            // Add project_id for project-level grouping
            $table->foreignId('project_id')
                ->nullable()
                ->after('id')
                ->constrained('locations')
                ->onDelete('cascade');
        });

        // Backfill project_id from qa_stage for existing records
        DB::statement('
            UPDATE drawing_sheets
            SET project_id = (
                SELECT location_id FROM qa_stages WHERE qa_stages.id = drawing_sheets.qa_stage_id
            )
            WHERE qa_stage_id IS NOT NULL AND project_id IS NULL
        ');

        // Add index for finding sheets by drawing_number within a project
        Schema::table('drawing_sheets', function (Blueprint $table) {
            $table->index(['project_id', 'sheet_number'], 'idx_project_sheet_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('drawing_sheets', function (Blueprint $table) {
            $table->dropIndex('idx_project_sheet_number');
            $table->dropForeign(['project_id']);
            $table->dropColumn('project_id');
        });
    }
};
