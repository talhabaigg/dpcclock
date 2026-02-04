<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     *
     * Adds tile-based rendering columns to qa_stage_drawings.
     * These columns support Leaflet.js tile-based viewer for large drawings.
     */
    public function up(): void
    {
        Schema::table('qa_stage_drawings', function (Blueprint $table) {
            // S3 base URL for tiles (e.g., "tiles/drawing_123")
            $table->string('tiles_base_url')->nullable()->after('thumbnail_s3_key');

            // Maximum zoom level available (0 = most zoomed out)
            $table->unsignedTinyInteger('tiles_max_zoom')->nullable()->after('tiles_base_url');

            // Original image dimensions (needed for Leaflet bounds calculation)
            $table->unsignedInteger('tiles_width')->nullable()->after('tiles_max_zoom');
            $table->unsignedInteger('tiles_height')->nullable()->after('tiles_width');

            // Tile size in pixels (typically 256 or 512)
            $table->unsignedSmallInteger('tile_size')->default(256)->after('tiles_height');

            // Tile generation status: pending, processing, completed, failed
            $table->string('tiles_status', 20)->nullable()->after('tile_size');

            // Index for querying drawings that need tile generation
            $table->index('tiles_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('qa_stage_drawings', function (Blueprint $table) {
            $table->dropIndex(['tiles_status']);
            $table->dropColumn([
                'tiles_base_url',
                'tiles_max_zoom',
                'tiles_width',
                'tiles_height',
                'tile_size',
                'tiles_status',
            ]);
        });
    }
};
