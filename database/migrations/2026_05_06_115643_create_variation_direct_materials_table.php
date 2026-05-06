<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('variation_direct_materials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('variation_id')->constrained('variations')->cascadeOnDelete();
            $table->foreignId('material_item_id')->nullable()->constrained('material_items')->nullOnDelete();
            $table->foreignId('cost_code_id')->nullable()->constrained('cost_codes')->nullOnDelete();
            $table->string('cost_type', 20)->nullable();
            $table->string('description')->nullable();
            $table->decimal('qty', 12, 4)->default(0);
            $table->decimal('unit_cost', 12, 2)->default(0);
            $table->decimal('sell_markup_pct', 6, 2)->default(25);
            $table->decimal('sell_cost', 12, 2)->default(0);
            $table->integer('line_number')->default(1);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index(['variation_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('variation_direct_materials');
    }
};
