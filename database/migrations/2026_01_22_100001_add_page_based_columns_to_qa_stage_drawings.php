<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds page-based structure to qa_stage_drawings.
     * Each drawing now represents a single page of a file.
     * The file_id + page_number combination uniquely identifies a page.
     *
     * Migration strategy:
     * 1. Add new columns (file_id, page_number) as nullable
     * 2. Data migration will populate these and create additional page records
     * 3. After data migration, we can make columns required
     */
    public function up(): void
    {
        Schema::table('qa_stage_drawings', function (Blueprint $table) {
            // Link to the file (nullable during migration)
            $table->foreignId('drawing_file_id')
                ->nullable()
                ->after('qa_stage_id')
                ->constrained('drawing_files')
                ->onDelete('cascade');

            // Page number within the file (1-based)
            $table->unsignedInteger('page_number')
                ->default(1)
                ->after('drawing_file_id');

            // Page-specific label (optional, e.g., "Floor Plan - Level 1")
            $table->string('page_label')->nullable()->after('page_number');

            // Index for unique page identification
            $table->unique(['drawing_file_id', 'page_number'], 'unique_file_page');

            // Index for efficient page queries
            $table->index(['drawing_file_id', 'page_number']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('qa_stage_drawings', function (Blueprint $table) {
            $table->dropForeign(['drawing_file_id']);
            $table->dropUnique('unique_file_page');
            $table->dropIndex(['drawing_file_id', 'page_number']);
            $table->dropColumn(['drawing_file_id', 'page_number', 'page_label']);
        });
    }
};
