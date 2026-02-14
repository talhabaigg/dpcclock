<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('measurement_segment_statuses')) {
            Schema::create('measurement_segment_statuses', function (Blueprint $table) {
                $table->id();
                $table->foreignId('drawing_measurement_id')->constrained('drawing_measurements')->cascadeOnDelete();
                $table->foreignId('labour_cost_code_id')->constrained('labour_cost_codes')->cascadeOnDelete();
                $table->unsignedSmallInteger('segment_index');
                $table->unsignedTinyInteger('percent_complete')->default(0);
                $table->date('work_date')->nullable();
                $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->unique(
                    ['drawing_measurement_id', 'labour_cost_code_id', 'segment_index', 'work_date'],
                    'seg_status_unique'
                );
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('measurement_segment_statuses');
    }
};
