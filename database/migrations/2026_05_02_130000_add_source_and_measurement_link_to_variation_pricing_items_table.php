<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('variation_pricing_items', function (Blueprint $table) {
            if (! Schema::hasColumn('variation_pricing_items', 'source')) {
                $table->enum('source', ['manual', 'measurement'])
                    ->default('manual')
                    ->after('takeoff_condition_id');
            }

            if (! Schema::hasColumn('variation_pricing_items', 'drawing_measurement_id')) {
                $table->foreignId('drawing_measurement_id')
                    ->nullable()
                    ->after('takeoff_condition_id')
                    ->constrained('drawing_measurements')
                    ->nullOnDelete();
            }

            if (! Schema::hasColumn('variation_pricing_items', 'last_synced_at')) {
                $table->timestamp('last_synced_at')->nullable()->after('updated_at');
            }
        });

        // Schema::getIndexes() works on both MySQL and SQLite.
        $existingIndexes = collect(Schema::getIndexes('variation_pricing_items'))
            ->pluck('name')
            ->all();

        Schema::table('variation_pricing_items', function (Blueprint $table) use ($existingIndexes) {
            if (! in_array('vpi_variation_condition_source_idx', $existingIndexes, true)) {
                $table->index(
                    ['variation_id', 'takeoff_condition_id', 'source'],
                    'vpi_variation_condition_source_idx'
                );
            }

            if (! in_array('vpi_variation_measurement_idx', $existingIndexes, true)) {
                $table->index(
                    ['variation_id', 'drawing_measurement_id'],
                    'vpi_variation_measurement_idx'
                );
            }
        });
    }

    public function down(): void
    {
        $existingIndexes = collect(Schema::getIndexes('variation_pricing_items'))
            ->pluck('name')
            ->all();

        Schema::table('variation_pricing_items', function (Blueprint $table) use ($existingIndexes) {
            if (in_array('vpi_variation_measurement_idx', $existingIndexes, true)) {
                $table->dropIndex('vpi_variation_measurement_idx');
            }

            if (in_array('vpi_variation_condition_source_idx', $existingIndexes, true)) {
                $table->dropIndex('vpi_variation_condition_source_idx');
            }
        });

        Schema::table('variation_pricing_items', function (Blueprint $table) {
            if (Schema::hasColumn('variation_pricing_items', 'drawing_measurement_id')) {
                $table->dropForeign(['drawing_measurement_id']);
                $table->dropColumn('drawing_measurement_id');
            }

            if (Schema::hasColumn('variation_pricing_items', 'last_synced_at')) {
                $table->dropColumn('last_synced_at');
            }

            if (Schema::hasColumn('variation_pricing_items', 'source')) {
                $table->dropColumn('source');
            }
        });
    }
};
