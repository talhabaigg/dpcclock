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
        Schema::create('employment_application_employee', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employment_application_id')->constrained('employment_applications', 'id', 'ea_employee_app_fk')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employees', 'id', 'ea_employee_emp_fk')->cascadeOnDelete();
            $table->string('eh_location_id')->nullable();
            $table->timestamp('linked_at');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employment_application_employee');
    }
};
