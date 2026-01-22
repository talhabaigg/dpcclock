<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('drawing_alignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('base_drawing_id')->constrained('qa_stage_drawings')->cascadeOnDelete();
            $table->foreignId('candidate_drawing_id')->constrained('qa_stage_drawings')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            // Transform data
            $table->decimal('scale', 10, 6)->default(1);
            $table->decimal('rotation', 10, 6)->default(0); // In radians
            $table->decimal('translate_x', 10, 6)->default(0); // As fraction (0-1)
            $table->decimal('translate_y', 10, 6)->default(0); // As fraction (0-1)
            $table->string('css_transform', 500)->nullable();

            // Alignment method
            $table->enum('method', ['manual', 'auto'])->default('manual');

            // Optional: store the alignment points for reference
            $table->json('alignment_points')->nullable();

            $table->timestamps();

            // Unique constraint: one alignment per base+candidate pair
            $table->unique(['base_drawing_id', 'candidate_drawing_id'], 'unique_drawing_pair');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('drawing_alignments');
    }
};
