<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employment_application_skills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employment_application_id')->constrained('employment_applications', 'id', 'emp_app_skill_app_id_foreign')->cascadeOnDelete();
            $table->unsignedBigInteger('skill_id')->nullable();
            $table->string('skill_name');
            $table->boolean('is_custom')->default(false);
            $table->timestamps();

            $table->index('skill_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employment_application_skills');
    }
};
