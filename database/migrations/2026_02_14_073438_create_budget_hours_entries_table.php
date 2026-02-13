<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('budget_hours_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained('locations')->cascadeOnDelete();
            $table->foreignId('bid_area_id')->nullable()->constrained('bid_areas')->cascadeOnDelete();
            $table->foreignId('labour_cost_code_id')->constrained('labour_cost_codes')->cascadeOnDelete();
            $table->date('work_date');
            $table->decimal('used_hours', 10, 2)->default(0);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(
                ['location_id', 'bid_area_id', 'labour_cost_code_id', 'work_date'],
                'budget_hours_unique'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('budget_hours_entries');
    }
};
