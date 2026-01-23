<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     *
     * Title block templates store reusable crop regions for extracting
     * metadata from drawing sheets. Templates are learned from user-drawn
     * capture boxes and can be reused across sheets with similar layouts.
     *
     * Typically 1-3 templates per project, not per sheet.
     */
    public function up(): void
    {
        Schema::create('title_block_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('locations')->onDelete('cascade');
            $table->string('name'); // User-friendly name e.g. "A1 Landscape Title Block"

            // Normalized crop rectangle (0..1 relative to image dimensions)
            // JSON: {x: 0.55, y: 0.60, w: 0.45, h: 0.40}
            $table->json('crop_rect');

            // Page characteristics for template matching
            $table->enum('orientation', ['portrait', 'landscape'])->nullable();

            // Size bucket for matching (e.g., "7016x4961" or "A1-ish")
            // Rounded dimensions to reduce noise
            $table->string('size_bucket', 50)->nullable();

            // Optional: anchor labels found in title block region
            // Can be used for validation (e.g., ["DRAWING NO", "REV", "TITLE"])
            $table->json('anchor_labels')->nullable();

            // Usage statistics
            $table->unsignedInteger('success_count')->default(0);
            $table->timestamp('last_used_at')->nullable();

            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->foreignId('updated_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['project_id', 'orientation', 'size_bucket']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('title_block_templates');
    }
};
