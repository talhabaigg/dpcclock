<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('labour_cost_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained('locations')->cascadeOnDelete();
            $table->string('code', 50);
            $table->string('name', 255);
            $table->string('unit', 20)->default('m²');
            $table->decimal('default_production_rate', 10, 4)->nullable();
            $table->decimal('default_hourly_rate', 10, 2)->nullable();
            $table->timestamps();

            $table->unique(['location_id', 'code'], 'lcc_location_code_unique');
        });

        Schema::create('condition_labour_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('takeoff_condition_id')->constrained('takeoff_conditions')->cascadeOnDelete();
            $table->foreignId('labour_cost_code_id')->constrained('labour_cost_codes')->cascadeOnDelete();
            $table->decimal('production_rate', 10, 4)->nullable();
            $table->decimal('hourly_rate', 10, 2)->nullable();
            $table->timestamps();

            $table->unique(['takeoff_condition_id', 'labour_cost_code_id'], 'condition_lcc_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('condition_labour_codes');
        Schema::dropIfExists('labour_cost_codes');
    }
};
