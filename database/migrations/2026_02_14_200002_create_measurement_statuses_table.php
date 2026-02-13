<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('measurement_statuses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('drawing_measurement_id')->constrained('drawing_measurements')->cascadeOnDelete();
            $table->foreignId('labour_cost_code_id')->constrained('labour_cost_codes')->cascadeOnDelete();
            $table->unsignedTinyInteger('percent_complete')->default(0);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['drawing_measurement_id', 'labour_cost_code_id'], 'measurement_lcc_status_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('measurement_statuses');
    }
};
