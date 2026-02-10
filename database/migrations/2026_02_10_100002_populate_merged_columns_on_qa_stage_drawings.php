<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Phase 1B: Populate the new merged columns from related tables.
     */
    public function up(): void
    {
        // 1. Populate project_id from DrawingSheet.project_id (drawing set sheets)
        DB::statement("
            UPDATE qa_stage_drawings
            SET project_id = (
                SELECT ds.project_id
                FROM drawing_sheets ds
                WHERE ds.id = qa_stage_drawings.drawing_sheet_id
                AND ds.project_id IS NOT NULL
            )
            WHERE drawing_sheet_id IS NOT NULL
            AND project_id IS NULL
        ");

        // 2. Populate project_id from DrawingSet.project_id
        DB::statement("
            UPDATE qa_stage_drawings
            SET project_id = (
                SELECT dset.project_id
                FROM drawing_sets dset
                WHERE dset.id = qa_stage_drawings.drawing_set_id
            )
            WHERE drawing_set_id IS NOT NULL
            AND project_id IS NULL
        ");

        // 3. Populate project_id from QaStage.location_id
        DB::statement("
            UPDATE qa_stage_drawings
            SET project_id = (
                SELECT qs.location_id
                FROM qa_stages qs
                WHERE qs.id = qa_stage_drawings.qa_stage_id
            )
            WHERE qa_stage_id IS NOT NULL
            AND project_id IS NULL
        ");

        // 4. Populate sheet_number, title, discipline, metadata_confirmed from DrawingSheet
        DB::statement("
            UPDATE qa_stage_drawings
            SET
                sheet_number = (SELECT ds.sheet_number FROM drawing_sheets ds WHERE ds.id = qa_stage_drawings.drawing_sheet_id),
                title = (SELECT ds.title FROM drawing_sheets ds WHERE ds.id = qa_stage_drawings.drawing_sheet_id),
                discipline = (SELECT ds.discipline FROM drawing_sheets ds WHERE ds.id = qa_stage_drawings.drawing_sheet_id),
                metadata_confirmed = COALESCE(
                    (SELECT ds.metadata_confirmed FROM drawing_sheets ds WHERE ds.id = qa_stage_drawings.drawing_sheet_id),
                    0
                )
            WHERE drawing_sheet_id IS NOT NULL
        ");

        // 5. Populate storage_path, original_name, mime_type, sha256 from DrawingFile
        DB::statement("
            UPDATE qa_stage_drawings
            SET
                storage_path = (SELECT df.storage_path FROM drawing_files df WHERE df.id = qa_stage_drawings.drawing_file_id),
                original_name = (SELECT df.original_name FROM drawing_files df WHERE df.id = qa_stage_drawings.drawing_file_id),
                mime_type = (SELECT df.mime_type FROM drawing_files df WHERE df.id = qa_stage_drawings.drawing_file_id),
                sha256 = (SELECT df.sha256 FROM drawing_files df WHERE df.id = qa_stage_drawings.drawing_file_id)
            WHERE drawing_file_id IS NOT NULL
        ");
    }

    public function down(): void
    {
        // Reset all merged columns to null
        DB::statement("
            UPDATE qa_stage_drawings
            SET project_id = NULL,
                sheet_number = NULL,
                title = NULL,
                discipline = NULL,
                storage_path = NULL,
                original_name = NULL,
                mime_type = NULL,
                sha256 = NULL,
                metadata_confirmed = 0
        ");
    }
};
