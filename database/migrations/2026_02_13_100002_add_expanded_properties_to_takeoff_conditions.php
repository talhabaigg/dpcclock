<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('takeoff_conditions', function (Blueprint $table) {
            if (! Schema::hasColumn('takeoff_conditions', 'condition_type_id')) {
                $table->foreignId('condition_type_id')
                    ->nullable()
                    ->after('location_id')
                    ->constrained('condition_types')
                    ->nullOnDelete();
            }
            if (! Schema::hasColumn('takeoff_conditions', 'condition_number')) {
                $table->unsignedInteger('condition_number')->nullable()->after('name');
            }
            if (! Schema::hasColumn('takeoff_conditions', 'height')) {
                $table->decimal('height', 8, 4)->nullable()->after('pricing_method');
            }
            if (! Schema::hasColumn('takeoff_conditions', 'thickness')) {
                $table->decimal('thickness', 8, 4)->nullable()->after('height');
            }
            if (! Schema::hasColumn('takeoff_conditions', 'pattern')) {
                $table->enum('pattern', ['solid', 'dashed', 'dotted', 'dashdot'])
                    ->default('solid')
                    ->after('color');
            }
        });

        // Migrate wall_height data to height
        if (Schema::hasColumn('takeoff_conditions', 'wall_height') && Schema::hasColumn('takeoff_conditions', 'height')) {
            DB::statement('UPDATE takeoff_conditions SET height = wall_height WHERE wall_height IS NOT NULL AND height IS NULL');
        }

        // Drop wall_height
        if (Schema::hasColumn('takeoff_conditions', 'wall_height')) {
            Schema::table('takeoff_conditions', function (Blueprint $table) {
                $table->dropColumn('wall_height');
            });
        }

        // Auto-assign condition_number for existing conditions
        $locations = DB::table('takeoff_conditions')
            ->whereNull('condition_number')
            ->distinct()
            ->pluck('location_id');

        foreach ($locations as $locationId) {
            $conditions = DB::table('takeoff_conditions')
                ->where('location_id', $locationId)
                ->whereNull('condition_number')
                ->orderBy('id')
                ->pluck('id');

            foreach ($conditions as $i => $id) {
                DB::table('takeoff_conditions')
                    ->where('id', $id)
                    ->update(['condition_number' => $i + 1]);
            }
        }
    }

    public function down(): void
    {
        // Re-add wall_height
        Schema::table('takeoff_conditions', function (Blueprint $table) {
            if (! Schema::hasColumn('takeoff_conditions', 'wall_height')) {
                $table->decimal('wall_height', 8, 4)->nullable()->after('pricing_method');
            }
        });

        // Copy height back to wall_height
        if (Schema::hasColumn('takeoff_conditions', 'height') && Schema::hasColumn('takeoff_conditions', 'wall_height')) {
            DB::statement('UPDATE takeoff_conditions SET wall_height = height WHERE height IS NOT NULL');
        }

        Schema::table('takeoff_conditions', function (Blueprint $table) {
            $cols = [];
            if (Schema::hasColumn('takeoff_conditions', 'pattern')) {
                $cols[] = 'pattern';
            }
            if (Schema::hasColumn('takeoff_conditions', 'thickness')) {
                $cols[] = 'thickness';
            }
            if (Schema::hasColumn('takeoff_conditions', 'height')) {
                $cols[] = 'height';
            }
            if (Schema::hasColumn('takeoff_conditions', 'condition_number')) {
                $cols[] = 'condition_number';
            }
            if (! empty($cols)) {
                $table->dropColumn($cols);
            }
        });

        // Drop FK separately to avoid issues
        if (Schema::hasColumn('takeoff_conditions', 'condition_type_id')) {
            Schema::table('takeoff_conditions', function (Blueprint $table) {
                $table->dropConstrainedForeignId('condition_type_id');
            });
        }
    }
};
