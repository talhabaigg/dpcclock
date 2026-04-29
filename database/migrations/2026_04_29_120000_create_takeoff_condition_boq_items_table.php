<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('takeoff_condition_boq_items')) {
            return;
        }

        Schema::create('takeoff_condition_boq_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('takeoff_condition_id')
                ->constrained('takeoff_conditions')
                ->cascadeOnDelete();
            $table->enum('kind', ['labour', 'material']);
            $table->foreignId('cost_code_id')
                ->nullable()
                ->constrained('cost_codes')
                ->nullOnDelete();
            $table->foreignId('labour_cost_code_id')
                ->nullable()
                ->constrained('labour_cost_codes')
                ->nullOnDelete();
            $table->decimal('unit_rate', 12, 4);
            $table->decimal('production_rate', 10, 2)->nullable();
            $table->string('notes', 500)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['takeoff_condition_id', 'kind'], 'boq_items_condition_kind_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('takeoff_condition_boq_items');
    }
};
