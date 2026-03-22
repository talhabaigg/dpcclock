<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employment_application_references', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employment_application_id')->constrained('employment_applications', 'id', 'emp_app_ref_app_id_foreign')->cascadeOnDelete();
            $table->tinyInteger('sort_order');
            $table->string('company_name');
            $table->string('position');
            $table->string('employment_period');
            $table->string('contact_person');
            $table->string('phone_number');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employment_application_references');
    }
};
