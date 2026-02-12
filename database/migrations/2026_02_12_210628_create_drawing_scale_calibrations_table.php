<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('drawing_scale_calibrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('drawing_id')->constrained('drawings')->cascadeOnDelete();
            $table->string('method', 20)->default('manual'); // 'manual' | 'preset'

            // Manual calibration: two points on the drawing
            $table->decimal('point_a_x', 8, 6)->nullable();
            $table->decimal('point_a_y', 8, 6)->nullable();
            $table->decimal('point_b_x', 8, 6)->nullable();
            $table->decimal('point_b_y', 8, 6)->nullable();
            $table->decimal('real_distance', 12, 4)->nullable();

            // Preset calibration: paper size + drawing scale
            $table->string('paper_size', 10)->nullable(); // A0, A1, A2, A3, A4
            $table->string('drawing_scale', 20)->nullable(); // 1:50, 1:100, etc.

            // Common fields
            $table->string('unit', 20); // mm, cm, m, in, ft
            $table->decimal('pixels_per_unit', 16, 6);

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique('drawing_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drawing_scale_calibrations');
    }
};
