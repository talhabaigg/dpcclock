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
        Schema::create('qa_stage_drawing_observations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('qa_stage_drawing_id')->constrained('qa_stage_drawings')->onDelete('cascade');
            $table->unsignedInteger('page_number');
            $table->decimal('x', 8, 6);
            $table->decimal('y', 8, 6);
            $table->string('type');
            $table->text('description');
            $table->string('photo_path')->nullable();
            $table->string('photo_name')->nullable();
            $table->string('photo_type')->nullable();
            $table->bigInteger('photo_size')->nullable();
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->foreignId('updated_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('qa_stage_drawing_observations');
    }
};
