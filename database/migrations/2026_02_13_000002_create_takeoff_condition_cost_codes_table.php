<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('takeoff_condition_cost_codes')) {
            Schema::create('takeoff_condition_cost_codes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('takeoff_condition_id')
                    ->constrained('takeoff_conditions')
                    ->cascadeOnDelete();
                $table->foreignId('cost_code_id')
                    ->constrained('cost_codes')
                    ->cascadeOnDelete();
                $table->decimal('unit_rate', 10, 2);
                $table->timestamps();

                $table->unique(
                    ['takeoff_condition_id', 'cost_code_id'],
                    'condition_cost_code_unique'
                );
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('takeoff_condition_cost_codes');
    }
};
