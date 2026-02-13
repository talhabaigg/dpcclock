<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('variation_pricing_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('variation_id')->constrained('variations')->cascadeOnDelete();
            $table->foreignId('takeoff_condition_id')->nullable()->constrained('takeoff_conditions')->nullOnDelete();
            $table->string('description');
            $table->decimal('qty', 12, 4);
            $table->string('unit', 20)->default('EA');
            $table->decimal('labour_cost', 12, 2)->default(0);
            $table->decimal('material_cost', 12, 2)->default(0);
            $table->decimal('total_cost', 12, 2)->default(0);
            $table->decimal('sell_rate', 12, 2)->nullable();
            $table->decimal('sell_total', 12, 2)->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('variation_pricing_items');
    }
};
