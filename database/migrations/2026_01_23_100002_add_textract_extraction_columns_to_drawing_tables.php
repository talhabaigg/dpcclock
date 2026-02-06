<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds AWS Textract extraction columns to qa_stage_drawings table.
     * These columns support the metadata extraction pipeline for drawing sheets.
     */
    public function up(): void
    {
        // Add drawing_set_id and extraction columns to qa_stage_drawings
        Schema::table('qa_stage_drawings', function (Blueprint $table) {
            // Link to the drawing set (PDF upload)
            $table->foreignId('drawing_set_id')
                ->nullable()
                ->after('drawing_file_id')
                ->constrained('drawing_sets')
                ->onDelete('cascade');

            // Page image storage
            $table->string('page_preview_s3_key')->nullable()->after('thumbnail_path');

            // Page dimensions (from rendered PNG)
            $table->unsignedInteger('page_width_px')->nullable()->after('page_preview_s3_key');
            $table->unsignedInteger('page_height_px')->nullable()->after('page_width_px');

            // Page orientation derived from dimensions
            $table->enum('page_orientation', ['portrait', 'landscape'])->nullable()->after('page_height_px');

            // Size bucket for template matching (e.g., "7016x4961")
            $table->string('size_bucket', 50)->nullable()->after('page_orientation');

            // Extracted metadata fields
            $table->string('drawing_number', 100)->nullable()->after('size_bucket');
            $table->string('drawing_title', 500)->nullable()->after('drawing_number');
            $table->string('revision', 50)->nullable()->after('drawing_title');

            // Extraction status (separate from workflow status)
            $table->enum('extraction_status', [
                'queued',       // Waiting for extraction
                'processing',   // Textract in progress
                'success',      // Extraction passed validation
                'needs_review', // Extraction failed validation, user must review
                'failed',       // Hard error during extraction
            ])->default('queued')->after('revision');

            // Confidence scores from Textract (0.0 to 1.0)
            $table->decimal('confidence_number', 4, 3)->nullable()->after('extraction_status');
            $table->decimal('confidence_title', 4, 3)->nullable()->after('confidence_number');
            $table->decimal('confidence_revision', 4, 3)->nullable()->after('confidence_title');

            // Template used for successful extraction
            $table->foreignId('used_template_id')
                ->nullable()
                ->after('confidence_revision')
                ->constrained('title_block_templates')
                ->onDelete('set null');

            // Raw Textract response (minimal: query answers + confidences)
            $table->json('extraction_raw')->nullable()->after('used_template_id');

            // Extraction errors for debugging
            $table->json('extraction_errors')->nullable()->after('extraction_raw');

            // When extraction completed
            $table->timestamp('extracted_at')->nullable()->after('extraction_errors');

            // Indexes for efficient querying
            $table->index(['drawing_set_id', 'extraction_status']);
            $table->index(['extraction_status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('qa_stage_drawings', function (Blueprint $table) {
            $table->dropForeign(['drawing_set_id']);
            $table->dropForeign(['used_template_id']);
            $table->dropIndex(['drawing_set_id', 'extraction_status']);
            $table->dropIndex(['extraction_status']);

            $table->dropColumn([
                'drawing_set_id',
                'page_preview_s3_key',
                'page_width_px',
                'page_height_px',
                'page_orientation',
                'size_bucket',
                'drawing_number',
                'drawing_title',
                'revision',
                'extraction_status',
                'confidence_number',
                'confidence_title',
                'confidence_revision',
                'used_template_id',
                'extraction_raw',
                'extraction_errors',
                'extracted_at',
            ]);
        });
    }
};
