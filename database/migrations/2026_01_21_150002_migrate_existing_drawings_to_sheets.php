<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Creates drawing_sheet records for existing qa_stage_drawings
     * and links them together.
     */
    public function up(): void
    {
        // Get all existing drawings that don't have a drawing_sheet_id
        $drawings = DB::table('qa_stage_drawings')
            ->whereNull('drawing_sheet_id')
            ->whereNull('deleted_at')
            ->get();

        foreach ($drawings as $drawing) {
            // Create a drawing_sheet for each existing drawing
            $sheetId = DB::table('drawing_sheets')->insertGetId([
                'qa_stage_id' => $drawing->qa_stage_id,
                'sheet_number' => null, // Will be populated by AI or user
                'title' => $drawing->name,
                'discipline' => null,
                'current_revision_id' => null, // Set after update
                'revision_count' => 1,
                'last_revision_at' => $drawing->created_at,
                'extraction_confidence' => null,
                'metadata_confirmed' => false,
                'created_by' => $drawing->created_by,
                'updated_by' => $drawing->updated_by,
                'created_at' => $drawing->created_at,
                'updated_at' => now(),
            ]);

            // Link the drawing to its sheet and set as active
            DB::table('qa_stage_drawings')
                ->where('id', $drawing->id)
                ->update([
                    'drawing_sheet_id' => $sheetId,
                    'revision_number' => 'A', // Default first revision
                    'status' => 'active',
                    'updated_at' => now(),
                ]);

            // Update the sheet to point to this as current revision
            DB::table('drawing_sheets')
                ->where('id', $sheetId)
                ->update([
                    'current_revision_id' => $drawing->id,
                ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove links from drawings
        DB::table('qa_stage_drawings')
            ->whereNotNull('drawing_sheet_id')
            ->update([
                'drawing_sheet_id' => null,
                'revision_number' => null,
                'status' => 'draft',
            ]);

        // Delete all drawing_sheets (they were auto-created)
        DB::table('drawing_sheets')->delete();
    }
};
