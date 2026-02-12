<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('takeoff_conditions', function (Blueprint $table) {
            if (! Schema::hasColumn('takeoff_conditions', 'pricing_method')) {
                $table->enum('pricing_method', ['unit_rate', 'build_up'])
                    ->default('build_up')
                    ->after('description');
            }
            if (! Schema::hasColumn('takeoff_conditions', 'wall_height')) {
                $table->decimal('wall_height', 8, 4)->nullable()->after('pricing_method');
            }
            if (! Schema::hasColumn('takeoff_conditions', 'labour_unit_rate')) {
                $table->decimal('labour_unit_rate', 10, 2)->nullable()->after('wall_height');
            }
        });
    }

    public function down(): void
    {
        Schema::table('takeoff_conditions', function (Blueprint $table) {
            $cols = [];
            if (Schema::hasColumn('takeoff_conditions', 'labour_unit_rate')) {
                $cols[] = 'labour_unit_rate';
            }
            if (Schema::hasColumn('takeoff_conditions', 'wall_height')) {
                $cols[] = 'wall_height';
            }
            if (Schema::hasColumn('takeoff_conditions', 'pricing_method')) {
                $cols[] = 'pricing_method';
            }
            if (! empty($cols)) {
                $table->dropColumn($cols);
            }
        });
    }
};
