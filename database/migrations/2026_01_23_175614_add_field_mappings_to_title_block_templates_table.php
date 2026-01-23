<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds field_mappings column to store granular field coordinates.
     * Structure:
     * {
     *   "drawing_number": {"x": 0.8, "y": 0.9, "w": 0.15, "h": 0.05, "text_pattern": "NTA-DRW-*"},
     *   "drawing_title": {"x": 0.1, "y": 0.7, "w": 0.8, "h": 0.1, "text_pattern": null},
     *   "revision": {"x": 0.95, "y": 0.9, "w": 0.04, "h": 0.05, "text_pattern": null}
     * }
     */
    public function up(): void
    {
        Schema::table('title_block_templates', function (Blueprint $table) {
            $table->json('field_mappings')->nullable()->after('crop_rect');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('title_block_templates', function (Blueprint $table) {
            $table->dropColumn('field_mappings');
        });
    }
};
