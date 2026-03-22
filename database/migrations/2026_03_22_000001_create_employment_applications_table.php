<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employment_applications', function (Blueprint $table) {
            $table->id();

            // Personal Details
            $table->string('surname');
            $table->string('first_name');
            $table->string('suburb');
            $table->string('email')->index();
            $table->string('phone');
            $table->date('date_of_birth');
            $table->text('why_should_we_employ_you');
            $table->string('referred_by')->nullable();
            $table->boolean('aboriginal_or_tsi')->nullable();

            // Occupation
            $table->string('occupation');
            $table->tinyInteger('apprentice_year')->nullable();
            $table->boolean('trade_qualified')->nullable();
            $table->string('occupation_other')->nullable();

            // Project/Site
            $table->string('preferred_project_site')->nullable();

            // Licences & Tickets
            $table->string('safety_induction_number');
            $table->boolean('ewp_below_11m')->default(false);
            $table->boolean('ewp_above_11m')->default(false);
            $table->string('forklift_licence_number')->nullable();
            $table->boolean('work_safely_at_heights');
            $table->string('scaffold_licence_number')->nullable();
            $table->date('first_aid_completion_date')->nullable();
            $table->boolean('workplace_impairment_training');
            $table->date('wit_completion_date')->nullable();
            $table->boolean('asbestos_awareness_training');
            $table->boolean('crystalline_silica_course');
            $table->boolean('gender_equity_training');
            $table->string('quantitative_fit_test');

            // Medical History
            $table->boolean('workcover_claim')->nullable();
            $table->string('medical_condition')->nullable();
            $table->string('medical_condition_other')->nullable();

            // Acceptance / Declaration
            $table->string('acceptance_full_name');
            $table->string('acceptance_email');
            $table->date('acceptance_date');
            $table->boolean('declaration_accepted');

            // Pipeline
            $table->string('status')->default('new')->index();
            $table->timestamp('declined_at')->nullable();
            $table->foreignId('declined_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('declined_reason')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employment_applications');
    }
};
