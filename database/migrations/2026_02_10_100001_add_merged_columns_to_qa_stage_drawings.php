<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Phase 1A: Add columns absorbed from DrawingFile, DrawingSheet, and QaStage.
     * These columns allow the Drawing model to be self-contained (1 file = 1 drawing).
     */
    public function up(): void
    {
        Schema::table('qa_stage_drawings', function (Blueprint $table) {
            // Project (Location) ID — replaces qa_stage_id → location chain
            $table->foreignId('project_id')
                ->nullable()
                ->after('id')
                ->constrained('locations')
                ->onDelete('cascade');

            // Sheet identity (from DrawingSheet)
            $table->string('sheet_number', 100)->nullable()->after('project_id');
            $table->string('title', 500)->nullable()->after('sheet_number');
            $table->string('discipline', 100)->nullable()->after('title');

            // File storage (from DrawingFile)
            $table->string('storage_path')->nullable()->after('discipline');
            $table->string('original_name')->nullable()->after('storage_path');
            $table->string('mime_type')->nullable()->after('original_name');
            $table->string('sha256', 64)->nullable()->after('mime_type');

            // Metadata confirmation (from DrawingSheet)
            $table->boolean('metadata_confirmed')->default(false)->after('sha256');

            // Index for revision grouping
            $table->index(['project_id', 'sheet_number']);
        });
    }

    public function down(): void
    {
        Schema::table('qa_stage_drawings', function (Blueprint $table) {
            $table->dropForeign(['project_id']);
            $table->dropIndex(['project_id', 'sheet_number']);
            $table->dropColumn([
                'project_id',
                'sheet_number',
                'title',
                'discipline',
                'storage_path',
                'original_name',
                'mime_type',
                'sha256',
                'metadata_confirmed',
            ]);
        });
    }
};
