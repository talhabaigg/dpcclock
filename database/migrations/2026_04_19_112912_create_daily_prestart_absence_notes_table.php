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
        Schema::create('daily_prestart_absence_notes', function (Blueprint $table) {
            $table->id();
            $table->uuid('daily_prestart_id');
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->text('note')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullifyOnDelete();
            $table->timestamps();

            $table->foreign('daily_prestart_id')
                ->references('id')
                ->on('daily_prestarts')
                ->cascadeOnDelete();
            $table->unique(['daily_prestart_id', 'employee_id'], 'uniq_prestart_employee_note');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('daily_prestart_absence_notes');
    }
};
