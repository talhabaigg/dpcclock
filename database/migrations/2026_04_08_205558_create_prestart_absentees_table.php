<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prestart_absentees', function (Blueprint $table) {
            $table->id();
            $table->uuid('daily_prestart_id');
            $table->unsignedBigInteger('employee_id');
            $table->string('reason')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign('daily_prestart_id')->references('id')->on('daily_prestarts')->cascadeOnDelete();
            $table->foreign('employee_id')->references('id')->on('employees')->cascadeOnDelete();

            $table->unique(['daily_prestart_id', 'employee_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prestart_absentees');
    }
};
