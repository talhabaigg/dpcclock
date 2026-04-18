<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Drawing feature cleanup:
 * - Truncate all drawing-related rows (unreleased feature, no data to preserve)
 * - Drop dead Textract extraction stack (columns + title_block_templates table)
 * - Drop dead DrawingAlignment stack (drawing_alignments table)
 * - Drop dead comparison column (diff_image_path)
 * - Drop legacy file-tracking columns (replaced by Spatie Media Library)
 * - Drop default-only noise columns (page_number, quantity_multiplier, etc.)
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Truncate all drawing data — user confirmed no production data to preserve.
        Schema::disableForeignKeyConstraints();
        DB::table('measurement_segment_statuses')->truncate();
        DB::table('measurement_statuses')->truncate();
        DB::table('drawing_measurements')->truncate();
        DB::table('drawing_scale_calibrations')->truncate();
        DB::table('drawing_observations')->truncate();
        if (Schema::hasTable('drawing_alignments')) {
            DB::table('drawing_alignments')->truncate();
        }
        if (Schema::hasTable('title_block_templates')) {
            DB::table('title_block_templates')->truncate();
        }
        DB::table('drawings')->truncate();
        Schema::enableForeignKeyConstraints();

        // 2. Drop FKs that block column/table drops
        $fksToDrop = [
            'drawings_source_drawing_id_foreign',
            'qa_stage_drawings_used_template_id_foreign',
        ];
        foreach ($fksToDrop as $fk) {
            try {
                Schema::table('drawings', function ($table) use ($fk) {
                    $table->dropForeign($fk);
                });
            } catch (\Exception $e) {
                // FK may already be gone
            }
        }

        // 3. Drop dead tables
        Schema::dropIfExists('drawing_alignments');
        Schema::dropIfExists('title_block_templates');

        // 4. Drop dead columns from `drawings`
        $deadColumns = [
            // Legacy file tracking — replaced by Spatie Media Library
            'storage_path', 'original_name', 'mime_type', 'file_size', 'sha256',
            'thumbnail_path', 'thumbnail_s3_key',
            'file_path', 'file_name', 'file_type',

            // Textract extraction stack
            'page_preview_s3_key', 'page_width_px', 'page_height_px',
            'page_orientation', 'size_bucket',
            'drawing_number', 'drawing_title', 'revision',
            'extraction_status', 'confidence_number', 'confidence_title',
            'confidence_revision', 'used_template_id',
            'extraction_raw', 'extraction_errors', 'extracted_at',
            'ai_extracted_metadata', 'page_dimensions',

            // Comparison stack
            'diff_image_path',

            // Default-only / never-varied columns
            'name', 'page_number', 'metadata_confirmed', 'quantity_multiplier',
            'revision_date', 'revision_notes', 'floor_label',
            'source_drawing_id', 'discipline',
        ];

        foreach ($deadColumns as $column) {
            if (Schema::hasColumn('drawings', $column)) {
                try {
                    Schema::table('drawings', function ($table) use ($column) {
                        $table->dropColumn($column);
                    });
                } catch (\Exception $e) {
                    // Column may have an index/FK that needs dropping first — retry after cleanup
                    \Illuminate\Support\Facades\Log::warning("Failed to drop drawings.{$column}: ".$e->getMessage());
                }
            }
        }
    }

    public function down(): void
    {
        // One-way migration — feature was unreleased, reverting makes no sense.
    }
};
