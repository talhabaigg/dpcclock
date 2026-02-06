<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds revision tracking fields to qa_stage_drawings.
     * Each qa_stage_drawing now represents a specific revision of a drawing_sheet.
     */
    public function up(): void
    {
        Schema::table('qa_stage_drawings', function (Blueprint $table) {
            // Link to parent sheet (nullable for backward compatibility)
            $table->foreignId('drawing_sheet_id')
                ->nullable()
                ->after('qa_stage_id')
                ->constrained('drawing_sheets')
                ->onDelete('cascade');

            // Revision identification
            $table->string('revision_number', 20)->nullable()->after('name'); // e.g., "A", "B", "1", "2"
            $table->date('revision_date')->nullable()->after('revision_number');
            $table->text('revision_notes')->nullable()->after('revision_date');

            // Status workflow
            $table->enum('status', [
                'draft',           // Just uploaded, not yet processed
                'processing',      // AI extraction in progress
                'pending_review',  // Waiting for user to confirm metadata
                'active',          // Current active revision
                'superseded',      // Replaced by newer revision
                'archived',         // Manually archived
            ])->default('draft')->after('revision_notes');

            // Processing metadata
            $table->string('thumbnail_path')->nullable()->after('file_size');
            $table->json('ai_extracted_metadata')->nullable()->after('thumbnail_path'); // Raw AI response
            $table->json('page_dimensions')->nullable()->after('ai_extracted_metadata'); // {width, height, pages}

            // Diff tracking (stores path to diff image with previous revision)
            $table->string('diff_image_path')->nullable()->after('page_dimensions');
            $table->foreignId('previous_revision_id')->nullable()->after('diff_image_path');

            // Index for faster queries
            $table->index(['drawing_sheet_id', 'status']);
            $table->index(['qa_stage_id', 'status']);
        });

        // Add foreign key for previous_revision_id separately (self-reference)
        Schema::table('qa_stage_drawings', function (Blueprint $table) {
            $table->foreign('previous_revision_id')
                ->references('id')
                ->on('qa_stage_drawings')
                ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('qa_stage_drawings', function (Blueprint $table) {
            $table->dropForeign(['previous_revision_id']);
            $table->dropForeign(['drawing_sheet_id']);

            $table->dropIndex(['drawing_sheet_id', 'status']);
            $table->dropIndex(['qa_stage_id', 'status']);

            $table->dropColumn([
                'drawing_sheet_id',
                'revision_number',
                'revision_date',
                'revision_notes',
                'status',
                'thumbnail_path',
                'ai_extracted_metadata',
                'page_dimensions',
                'diff_image_path',
                'previous_revision_id',
            ]);
        });
    }
};
