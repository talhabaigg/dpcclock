<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. drawing_measurements — add watermelon_id
        if (!Schema::hasColumn('drawing_measurements', 'watermelon_id')) {
            Schema::table('drawing_measurements', function (Blueprint $table) {
                $table->string('watermelon_id', 36)->nullable()->unique()->after('id');
            });
        }

        // 2. measurement_statuses — add watermelon_id
        if (!Schema::hasColumn('measurement_statuses', 'watermelon_id')) {
            Schema::table('measurement_statuses', function (Blueprint $table) {
                $table->string('watermelon_id', 36)->nullable()->unique()->after('id');
            });
        }

        // 3. measurement_segment_statuses — add watermelon_id
        if (!Schema::hasColumn('measurement_segment_statuses', 'watermelon_id')) {
            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->string('watermelon_id', 36)->nullable()->unique()->after('id');
            });
        }

        // 4. measurement_segment_statuses — make labour_cost_code_id nullable
        //    and update unique constraint to exclude it (mobile doesn't send LCC for segments)
        $segStatusIndexes = collect(Schema::getIndexes('measurement_segment_statuses'));
        $oldUniqueExists = $segStatusIndexes->contains('name', 'seg_status_unique');

        if ($oldUniqueExists) {
            // Drop the old 4-column unique (includes labour_cost_code_id)
            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->dropUnique('seg_status_unique');
            });

            // Add a new 3-column unique without labour_cost_code_id
            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->unique(
                    ['drawing_measurement_id', 'segment_index', 'work_date'],
                    'seg_status_unique_v2'
                );
            });
        }

        // Make labour_cost_code_id nullable (drop FK first, alter, re-add)
        $fks = collect(\Illuminate\Support\Facades\DB::select(
            "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'measurement_segment_statuses' AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
        ))->pluck('CONSTRAINT_NAME');

        $lccFk = $fks->first(fn ($name) => str_contains($name, 'labour_cost_code_id'));

        if ($lccFk) {
            Schema::table('measurement_segment_statuses', function (Blueprint $table) use ($lccFk) {
                $table->dropForeign($lccFk);
            });

            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->foreignId('labour_cost_code_id')->nullable()->change();
            });

            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->foreign('labour_cost_code_id')
                    ->references('id')
                    ->on('labour_cost_codes')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        // Reverse labour_cost_code_id changes
        $fks = collect(\Illuminate\Support\Facades\DB::select(
            "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'measurement_segment_statuses' AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
        ))->pluck('CONSTRAINT_NAME');

        $lccFk = $fks->first(fn ($name) => str_contains($name, 'labour_cost_code_id'));

        if ($lccFk) {
            Schema::table('measurement_segment_statuses', function (Blueprint $table) use ($lccFk) {
                $table->dropForeign($lccFk);
            });

            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->foreignId('labour_cost_code_id')->change();
                $table->foreign('labour_cost_code_id')
                    ->references('id')
                    ->on('labour_cost_codes')
                    ->cascadeOnDelete();
            });
        }

        // Reverse unique constraint
        $segStatusIndexes = collect(Schema::getIndexes('measurement_segment_statuses'));

        if ($segStatusIndexes->contains('name', 'seg_status_unique_v2')) {
            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->dropUnique('seg_status_unique_v2');
            });

            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->unique(
                    ['drawing_measurement_id', 'labour_cost_code_id', 'segment_index', 'work_date'],
                    'seg_status_unique'
                );
            });
        }

        // Drop watermelon_id columns
        if (Schema::hasColumn('measurement_segment_statuses', 'watermelon_id')) {
            Schema::table('measurement_segment_statuses', function (Blueprint $table) {
                $table->dropColumn('watermelon_id');
            });
        }

        if (Schema::hasColumn('measurement_statuses', 'watermelon_id')) {
            Schema::table('measurement_statuses', function (Blueprint $table) {
                $table->dropColumn('watermelon_id');
            });
        }

        if (Schema::hasColumn('drawing_measurements', 'watermelon_id')) {
            Schema::table('drawing_measurements', function (Blueprint $table) {
                $table->dropColumn('watermelon_id');
            });
        }
    }
};
