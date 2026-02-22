<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Expand pricing_method enum to include 'detailed'
        if (Schema::hasColumn('takeoff_conditions', 'pricing_method')) {
            if (DB::getDriverName() === 'sqlite') {
                // SQLite doesn't support MODIFY — but also doesn't enforce ENUM, so this is a no-op
            } else {
                DB::statement("ALTER TABLE takeoff_conditions MODIFY pricing_method ENUM('unit_rate','build_up','detailed') NOT NULL DEFAULT 'build_up'");
            }
        }

        if (! Schema::hasTable('condition_line_items')) {
            Schema::create('condition_line_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('takeoff_condition_id')->constrained()->cascadeOnDelete();
                $table->smallInteger('sort_order')->unsigned()->default(0);
                $table->string('section', 100)->nullable();

                $table->enum('entry_type', ['material', 'labour'])->default('material');

                $table->foreignId('material_item_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('labour_cost_code_id')->nullable()->constrained()->nullOnDelete();

                $table->string('item_code', 50)->nullable();
                $table->string('description', 500)->nullable();

                $table->enum('qty_source', ['primary', 'secondary', 'fixed'])->default('primary');
                $table->decimal('fixed_qty', 16, 4)->nullable();

                $table->decimal('oc_spacing', 10, 4)->nullable();
                $table->smallInteger('layers')->unsigned()->default(1);
                $table->decimal('waste_percentage', 5, 2)->default(0);

                $table->decimal('unit_cost', 12, 4)->nullable();
                $table->enum('cost_source', ['material', 'manual'])->default('material');
                $table->string('uom', 20)->nullable();
                $table->decimal('pack_size', 10, 4)->nullable();

                $table->decimal('hourly_rate', 10, 2)->nullable();
                $table->decimal('production_rate', 10, 4)->nullable();

                $table->timestamps();

                $table->index(['takeoff_condition_id', 'sort_order']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('condition_line_items');

        if (Schema::hasColumn('takeoff_conditions', 'pricing_method') && DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE takeoff_conditions MODIFY pricing_method ENUM('unit_rate','build_up') NOT NULL DEFAULT 'build_up'");
        }
    }
};
