<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employment_application_screening_interviews', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('employment_application_id');
            $table->foreign('employment_application_id', 'screening_interviews_app_id_foreign')
                ->references('id')->on('employment_applications')->cascadeOnDelete();

            $table->unsignedBigInteger('completed_by')->nullable();
            $table->foreign('completed_by', 'screening_interviews_completed_by_foreign')
                ->references('id')->on('users')->nullOnDelete();
            $table->dateTime('completed_at')->nullable();

            // Header
            $table->string('interview_method')->nullable();
            $table->json('interviewer_names')->nullable();

            // Part B – Position & general info
            $table->json('position_applied_for')->nullable();
            $table->string('position_other')->nullable();
            $table->json('preferred_position')->nullable();
            $table->json('location_preference')->nullable();
            $table->string('location_other')->nullable();
            $table->text('why_employ_response')->nullable();
            $table->text('contract_employer_aware')->nullable();
            $table->text('perceived_honesty_ethic')->nullable();
            $table->string('matches_reference_checks')->nullable();
            $table->text('punctuality_perception')->nullable();
            $table->string('punctuality_acknowledged')->nullable();
            $table->string('family_holidays')->nullable();
            $table->text('family_holidays_dates')->nullable();
            $table->string('safe_environment_acknowledged')->nullable();

            // Part C – Tools
            $table->string('has_tools')->nullable();
            $table->text('tools_discussion')->nullable();
            $table->string('tools_tagged_in_date')->nullable();
            $table->string('tagging_acknowledged')->nullable();
            $table->string('productivity_acknowledged')->nullable();
            $table->text('productivity_discussion')->nullable();

            // Part D – Licences & tickets
            $table->string('white_card_number')->nullable();
            $table->date('white_card_date')->nullable();
            $table->boolean('white_card_attached')->nullable();

            $table->string('ewp_licence_type')->nullable();
            $table->string('ewp_licence_number')->nullable();
            $table->date('ewp_licence_date')->nullable();
            $table->boolean('ewp_licence_attached')->nullable();

            $table->string('high_risk_licence_type')->nullable();
            $table->string('high_risk_licence_number')->nullable();
            $table->date('high_risk_licence_date')->nullable();
            $table->boolean('high_risk_licence_attached')->nullable();

            $table->date('heights_training_date')->nullable();
            $table->boolean('heights_training_attached')->nullable();

            $table->string('scaffold_licence_number')->nullable();
            $table->date('scaffold_licence_date')->nullable();
            $table->boolean('scaffold_licence_attached')->nullable();

            $table->string('wit_completed')->nullable();
            $table->date('wit_date')->nullable();

            $table->string('fit_test_completed')->nullable();
            $table->string('fit_test_method')->nullable();
            $table->string('willing_to_undergo_fit_test')->nullable();

            $table->string('asbestos_awareness')->nullable();
            $table->string('silica_awareness')->nullable();
            $table->string('mental_health_awareness')->nullable();

            $table->date('first_aid_date')->nullable();
            $table->date('first_aid_refresher_date')->nullable();

            // Part E – Medical & IR
            $table->string('aware_of_collective_agreement')->nullable();
            $table->string('agree_to_discuss_with_rep')->nullable();
            $table->string('workcover_claim_discussed')->nullable();
            $table->string('medical_condition_discussed')->nullable();
            $table->text('medical_discussion_notes')->nullable();
            $table->string('disclosure_consequences_acknowledged')->nullable();

            $table->string('can_work_overhead')->nullable();
            $table->string('can_walk_stand')->nullable();
            $table->string('can_lift_carry')->nullable();
            $table->string('can_work_at_heights')->nullable();
            $table->string('can_operate_power_tools')->nullable();
            $table->string('can_perform_repetitive')->nullable();
            $table->string('can_operate_plant')->nullable();

            // Part F – Review reference checks
            $table->string('reference_checks_clarification')->nullable();
            $table->text('reference_checks_discussion')->nullable();
            $table->json('reason_for_leaving')->nullable();
            $table->string('reason_for_leaving_other')->nullable();

            // Part G – Applicant questions
            $table->text('applicant_questions')->nullable();

            // Part H – Additional
            $table->text('presentation_reasonable')->nullable();
            $table->text('is_interested')->nullable();
            $table->text('reviewed_contract')->nullable();
            $table->text('was_organised')->nullable();
            $table->text('additional_notes')->nullable();

            // Part I – Completed by (interviewer panel)
            $table->json('interviewers')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employment_application_screening_interviews');
    }
};
