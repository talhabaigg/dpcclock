<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('silica_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->boolean('performed');
            $table->json('tasks')->nullable();
            $table->unsignedInteger('duration_minutes')->nullable();
            $table->boolean('swms_compliant')->nullable();
            $table->json('control_measures')->nullable();
            $table->string('respirator_type')->nullable();
            $table->date('clock_out_date');
            $table->timestamps();

            $table->index(['employee_id', 'clock_out_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('silica_entries');
    }
};
