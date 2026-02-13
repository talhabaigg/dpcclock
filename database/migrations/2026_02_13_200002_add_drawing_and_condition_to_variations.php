<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add drawing_id and markup to variations
        Schema::table('variations', function (Blueprint $table) {
            if (! Schema::hasColumn('variations', 'drawing_id')) {
                $table->foreignId('drawing_id')
                    ->nullable()
                    ->after('location_id')
                    ->constrained('drawings')
                    ->nullOnDelete();
            }
            if (! Schema::hasColumn('variations', 'markup_percentage')) {
                $table->decimal('markup_percentage', 5, 2)
                    ->nullable()
                    ->after('premier_co_id');
            }
        });

        // Add condition/measurement/cost_code FKs to variation line items
        Schema::table('variation_line_items', function (Blueprint $table) {
            if (! Schema::hasColumn('variation_line_items', 'drawing_measurement_id')) {
                $table->foreignId('drawing_measurement_id')
                    ->nullable()
                    ->after('revenue')
                    ->constrained('drawing_measurements')
                    ->nullOnDelete();
            }
            if (! Schema::hasColumn('variation_line_items', 'takeoff_condition_id')) {
                $table->foreignId('takeoff_condition_id')
                    ->nullable()
                    ->after('drawing_measurement_id')
                    ->constrained('takeoff_conditions')
                    ->nullOnDelete();
            }
            if (! Schema::hasColumn('variation_line_items', 'cost_code_id')) {
                $table->foreignId('cost_code_id')
                    ->nullable()
                    ->after('takeoff_condition_id')
                    ->constrained('cost_codes')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('variation_line_items', function (Blueprint $table) {
            if (Schema::hasColumn('variation_line_items', 'cost_code_id')) {
                $table->dropConstrainedForeignId('cost_code_id');
            }
            if (Schema::hasColumn('variation_line_items', 'takeoff_condition_id')) {
                $table->dropConstrainedForeignId('takeoff_condition_id');
            }
            if (Schema::hasColumn('variation_line_items', 'drawing_measurement_id')) {
                $table->dropConstrainedForeignId('drawing_measurement_id');
            }
        });

        Schema::table('variations', function (Blueprint $table) {
            if (Schema::hasColumn('variations', 'markup_percentage')) {
                $table->dropColumn('markup_percentage');
            }
            if (Schema::hasColumn('variations', 'drawing_id')) {
                $table->dropConstrainedForeignId('drawing_id');
            }
        });
    }
};
