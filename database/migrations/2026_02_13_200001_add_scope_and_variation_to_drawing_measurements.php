<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drawing_measurements', function (Blueprint $table) {
            if (! Schema::hasColumn('drawing_measurements', 'scope')) {
                $table->enum('scope', ['takeoff', 'variation'])
                    ->default('takeoff')
                    ->after('unit');
            }
            if (! Schema::hasColumn('drawing_measurements', 'variation_id')) {
                $table->foreignId('variation_id')
                    ->nullable()
                    ->after('scope')
                    ->constrained('variations')
                    ->nullOnDelete();
            }
            if (! Schema::hasColumn('drawing_measurements', 'source_measurement_id')) {
                $table->foreignId('source_measurement_id')
                    ->nullable()
                    ->after('variation_id')
                    ->constrained('drawing_measurements')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('drawing_measurements', function (Blueprint $table) {
            $cols = [];
            if (Schema::hasColumn('drawing_measurements', 'source_measurement_id')) {
                $table->dropConstrainedForeignId('source_measurement_id');
            }
            if (Schema::hasColumn('drawing_measurements', 'variation_id')) {
                $table->dropConstrainedForeignId('variation_id');
            }
            if (Schema::hasColumn('drawing_measurements', 'scope')) {
                $cols[] = 'scope';
            }
            if (! empty($cols)) {
                $table->dropColumn($cols);
            }
        });
    }
};
