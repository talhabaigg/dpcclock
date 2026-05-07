<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Restore per-LCC uniqueness on measurement_segment_statuses so each
     * labour cost code can track its own segment progress independently.
     * v2 dropped LCC from the unique key for a (now-unused) mobile sync flow;
     * the production page model is per-trade per-segment.
     */
    public function up(): void
    {
        // 1. Clean up rows with NULL labour_cost_code_id (legacy v2 data).
        DB::table('measurement_segment_statuses')->whereNull('labour_cost_code_id')->delete();

        // 2. Replace v2 unique with v3 that includes labour_cost_code_id.
        $indexes = collect(Schema::getIndexes('measurement_segment_statuses'));

        if ($indexes->contains('name', 'seg_status_unique_v2')) {
            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->index('drawing_measurement_id', 'seg_status_dm_idx_temp');
            });
            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->dropUnique('seg_status_unique_v2');
            });
            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->unique(
                    ['drawing_measurement_id', 'labour_cost_code_id', 'segment_index', 'work_date'],
                    'seg_status_unique_v3'
                );
            });
            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->dropIndex('seg_status_dm_idx_temp');
            });
        } elseif (! $indexes->contains('name', 'seg_status_unique_v3')) {
            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->unique(
                    ['drawing_measurement_id', 'labour_cost_code_id', 'segment_index', 'work_date'],
                    'seg_status_unique_v3'
                );
            });
        }
    }

    public function down(): void
    {
        $indexes = collect(Schema::getIndexes('measurement_segment_statuses'));

        if ($indexes->contains('name', 'seg_status_unique_v3')) {
            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->index('drawing_measurement_id', 'seg_status_dm_idx_temp');
            });
            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->dropUnique('seg_status_unique_v3');
            });
            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->unique(
                    ['drawing_measurement_id', 'segment_index', 'work_date'],
                    'seg_status_unique_v2'
                );
            });
            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->dropIndex('seg_status_dm_idx_temp');
            });
        }
    }
};
