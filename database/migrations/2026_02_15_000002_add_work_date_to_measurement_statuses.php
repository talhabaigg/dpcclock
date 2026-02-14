<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('measurement_statuses', 'work_date')) {
            Schema::table('measurement_statuses', function (Blueprint $table) {
                $table->date('work_date')->nullable()->after('percent_complete');
            });
        }

        // The unique index is used by the FK on drawing_measurement_id.
        // Add a plain index on drawing_measurement_id first so MySQL has an index for the FK,
        // then drop the old unique and add the new one.
        $oldIndexExists = collect(\DB::select(
            "SELECT INDEX_NAME FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'measurement_statuses'
             AND INDEX_NAME = 'measurement_lcc_status_unique'"
        ))->isNotEmpty();

        if ($oldIndexExists) {
            // Add a plain index for the FK before dropping the unique
            Schema::table('measurement_statuses', function (Blueprint $table) {
                $table->index('drawing_measurement_id', 'ms_measurement_id_index');
            });

            Schema::table('measurement_statuses', function (Blueprint $table) {
                $table->dropUnique('measurement_lcc_status_unique');
            });

            Schema::table('measurement_statuses', function (Blueprint $table) {
                $table->unique(
                    ['drawing_measurement_id', 'labour_cost_code_id', 'work_date'],
                    'measurement_lcc_date_unique'
                );
            });

            // Drop the temporary plain index — the new unique index covers the FK
            Schema::table('measurement_statuses', function (Blueprint $table) {
                $table->dropIndex('ms_measurement_id_index');
            });
        }
    }

    public function down(): void
    {
        $newIndexExists = collect(\DB::select(
            "SELECT INDEX_NAME FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'measurement_statuses'
             AND INDEX_NAME = 'measurement_lcc_date_unique'"
        ))->isNotEmpty();

        if ($newIndexExists) {
            Schema::table('measurement_statuses', function (Blueprint $table) {
                $table->dropUnique('measurement_lcc_date_unique');
            });

            Schema::table('measurement_statuses', function (Blueprint $table) {
                $table->unique(
                    ['drawing_measurement_id', 'labour_cost_code_id'],
                    'measurement_lcc_status_unique'
                );
            });
        }

        if (Schema::hasColumn('measurement_statuses', 'work_date')) {
            Schema::table('measurement_statuses', function (Blueprint $table) {
                $table->dropColumn('work_date');
            });
        }
    }
};
