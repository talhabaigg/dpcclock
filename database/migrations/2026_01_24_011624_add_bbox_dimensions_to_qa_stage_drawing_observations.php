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
        Schema::table('qa_stage_drawing_observations', function (Blueprint $table) {
            // Bounding box dimensions (normalized 0-1) for CV-detected regions
            $table->decimal('bbox_width', 5, 4)->nullable()->after('y');
            $table->decimal('bbox_height', 5, 4)->nullable()->after('bbox_width');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('qa_stage_drawing_observations', function (Blueprint $table) {
            $table->dropColumn(['bbox_width', 'bbox_height']);
        });
    }
};
