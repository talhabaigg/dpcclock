<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('takeoff_condition_materials');
    }

    public function down(): void
    {
        Schema::create('takeoff_condition_materials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('takeoff_condition_id')->constrained()->cascadeOnDelete();
            $table->foreignId('material_item_id')->constrained()->cascadeOnDelete();
            $table->decimal('qty_per_unit', 12, 4);
            $table->decimal('waste_percentage', 5, 2)->default(0);
            $table->timestamps();
        });
    }
};
