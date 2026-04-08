<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_prestart_signatures', function (Blueprint $table) {
            $table->id();
            $table->uuid('daily_prestart_id');
            $table->unsignedBigInteger('employee_id');
            $table->text('signature');
            $table->json('content_snapshot')->nullable();
            $table->timestamp('signed_at');
            $table->unsignedBigInteger('clock_id')->nullable();
            $table->timestamps();

            $table->foreign('daily_prestart_id')->references('id')->on('daily_prestarts')->cascadeOnDelete();
            $table->foreign('employee_id')->references('id')->on('employees')->cascadeOnDelete();
            $table->foreign('clock_id')->references('id')->on('clocks')->nullOnDelete();

            $table->unique(['daily_prestart_id', 'employee_id']);
            $table->index('signed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_prestart_signatures');
    }
};
