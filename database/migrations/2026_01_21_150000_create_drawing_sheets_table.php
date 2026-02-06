<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Drawing sheets represent a unique sheet identity (e.g., "A-101 Ground Floor Plan")
     * that can have multiple revisions over time.
     */
    public function up(): void
    {
        Schema::create('drawing_sheets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('qa_stage_id')->constrained('qa_stages')->onDelete('cascade');

            // Sheet identification (extracted from title block or filename)
            $table->string('sheet_number', 50)->nullable(); // e.g., "A-101", "M-201"
            $table->string('title')->nullable(); // e.g., "Ground Floor Plan"
            $table->string('discipline', 50)->nullable(); // e.g., "Architectural", "Mechanical", "Electrical"

            // Current/latest revision reference
            $table->foreignId('current_revision_id')->nullable(); // Points to qa_stage_drawings

            // Metadata
            $table->integer('revision_count')->default(0);
            $table->timestamp('last_revision_at')->nullable();

            // AI extraction confidence (0-100)
            $table->unsignedTinyInteger('extraction_confidence')->nullable();
            $table->boolean('metadata_confirmed')->default(false); // User confirmed AI extraction

            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->foreignId('updated_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            $table->softDeletes();

            // Unique constraint: one sheet number per QA stage
            $table->unique(['qa_stage_id', 'sheet_number'], 'unique_sheet_per_stage');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('drawing_sheets');
    }
};
