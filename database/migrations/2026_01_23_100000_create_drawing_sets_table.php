<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Drawing sets represent a multi-page PDF upload that will be split
     * into individual drawing sheets for metadata extraction via AWS Textract.
     */
    public function up(): void
    {
        Schema::create('drawing_sets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('locations')->onDelete('cascade');
            $table->string('original_pdf_s3_key'); // S3 key for the original uploaded PDF
            $table->unsignedInteger('page_count')->default(0);
            $table->enum('status', [
                'queued',      // Waiting to be processed
                'processing',  // Currently splitting pages
                'partial',     // Some sheets failed extraction
                'success',     // All sheets extracted successfully
                'failed',      // Processing failed
            ])->default('queued');
            $table->string('original_filename')->nullable(); // Original uploaded filename
            $table->bigInteger('file_size')->nullable();
            $table->string('sha256', 64)->nullable(); // For deduplication
            $table->json('processing_errors')->nullable(); // Store any processing errors
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->foreignId('updated_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['project_id', 'status']);
            $table->index('sha256');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('drawing_sets');
    }
};
