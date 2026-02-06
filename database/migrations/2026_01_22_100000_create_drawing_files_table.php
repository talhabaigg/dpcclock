<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Creates a drawing_files table to store PDF/image file metadata.
     * Each file can have multiple pages, and each page becomes a separate drawing record.
     * This allows multi-page PDFs to be treated as individual drawings per page.
     */
    public function up(): void
    {
        Schema::create('drawing_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('qa_stage_id')->constrained('qa_stages')->onDelete('cascade');
            $table->string('storage_path'); // Path in storage (S3 or local)
            $table->string('original_name'); // Original uploaded filename
            $table->string('mime_type')->nullable();
            $table->bigInteger('file_size')->nullable();
            $table->string('sha256', 64)->nullable(); // For deduplication
            $table->unsignedInteger('page_count')->default(1);
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();
            $table->softDeletes();

            // Index for finding files by hash (deduplication)
            $table->index('sha256');
            $table->index(['qa_stage_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('drawing_files');
    }
};
