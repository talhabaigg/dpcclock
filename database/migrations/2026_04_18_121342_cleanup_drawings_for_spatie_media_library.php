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
 *
 * Ordering matters for SQLite, which rebuilds tables when columns are dropped
 * and re-validates FKs during the rebuild: drop the FK columns on `drawings`
 * BEFORE dropping the tables they reference.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::disableForeignKeyConstraints();

        try {
            // 1. Truncate all drawing data — user confirmed no production data to preserve.
            foreach ([
                'measurement_segment_statuses',
                'measurement_statuses',
                'drawing_measurements',
                'drawing_scale_calibrations',
                'drawing_observations',
                'drawing_alignments',
                'title_block_templates',
                'drawings',
            ] as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->truncate();
                }
            }

            // 2. Drop FK columns on `drawings` BEFORE dropping referenced tables.
            //    `dropConstrainedForeignId` removes the FK constraint + column together,
            //    using Laravel's auto-generated FK names (works on MySQL + SQLite).
            foreach (['used_template_id', 'source_drawing_id'] as $column) {
                if (Schema::hasColumn('drawings', $column)) {
                    try {
                        Schema::table('drawings', function ($table) use ($column) {
                            $table->dropConstrainedForeignId($column);
                        });
                    } catch (\Exception $e) {
                        // Fall back to dropping the FK manually then the column
                        try {
                            Schema::table('drawings', function ($table) use ($column) {
                                $table->dropForeign([$column]);
                            });
                        } catch (\Exception $e2) {
                            // FK may not exist
                        }
                        try {
                            Schema::table('drawings', function ($table) use ($column) {
                                $table->dropColumn($column);
                            });
                        } catch (\Exception $e3) {
                            \Illuminate\Support\Facades\Log::warning("Failed to drop drawings.{$column}: ".$e3->getMessage());
                        }
                    }
                }
            }

            // 3. Now safe to drop the dead tables.
            Schema::dropIfExists('drawing_alignments');
            Schema::dropIfExists('title_block_templates');

            // 4. Drop remaining dead columns from `drawings`.
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
                'confidence_revision',
                'extraction_raw', 'extraction_errors', 'extracted_at',
                'ai_extracted_metadata', 'page_dimensions',

                // Comparison stack
                'diff_image_path',

                // Default-only / never-varied columns
                'name', 'page_number', 'metadata_confirmed', 'quantity_multiplier',
                'revision_date', 'revision_notes', 'floor_label', 'discipline',
            ];

            foreach ($deadColumns as $column) {
                if (Schema::hasColumn('drawings', $column)) {
                    try {
                        Schema::table('drawings', function ($table) use ($column) {
                            $table->dropColumn($column);
                        });
                    } catch (\Exception $e) {
                        \Illuminate\Support\Facades\Log::warning("Failed to drop drawings.{$column}: ".$e->getMessage());
                    }
                }
            }
        } finally {
            Schema::enableForeignKeyConstraints();
        }
    }

    public function down(): void
    {
        // One-way migration — feature was unreleased, reverting makes no sense.
    }
};
