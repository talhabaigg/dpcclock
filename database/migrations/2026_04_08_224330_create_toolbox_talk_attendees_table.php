<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('toolbox_talk_attendees', function (Blueprint $table) {
            $table->id();
            $table->uuid('toolbox_talk_id');
            $table->unsignedBigInteger('employee_id');
            $table->boolean('signed')->default(false);
            $table->timestamps();

            $table->foreign('toolbox_talk_id')->references('id')->on('toolbox_talks')->cascadeOnDelete();
            $table->foreign('employee_id')->references('id')->on('employees')->cascadeOnDelete();
            $table->unique(['toolbox_talk_id', 'employee_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('toolbox_talk_attendees');
    }
};
