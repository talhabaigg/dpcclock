<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_transfers', function (Blueprint $table) {
            $table->id();

            // Header
            $table->foreignId('employee_id')->constrained('employees');
            $table->string('employee_name');
            $table->string('employee_position')->nullable();
            $table->unsignedBigInteger('current_kiosk_id');
            $table->foreign('current_kiosk_id')->references('id')->on('kiosks');
            $table->foreignId('current_foreman_id')->constrained('users');
            $table->unsignedBigInteger('proposed_kiosk_id');
            $table->foreign('proposed_kiosk_id')->references('id')->on('kiosks');
            $table->foreignId('receiving_foreman_id')->constrained('users');
            $table->date('proposed_start_date');
            $table->foreignId('initiated_by')->constrained('users');

            $table->string('status')->default('draft');
            // draft, submitted, receiving_foreman_review, final_review, approved, approved_with_conditions, declined

            // Part A - Reason for Transfer
            $table->string('transfer_reason');
            $table->text('transfer_reason_other')->nullable();

            // Part B - Internal Performance Snapshot
            $table->string('overall_performance')->nullable();
            $table->string('work_ethic_honesty')->nullable();
            $table->string('quality_of_work')->nullable();
            $table->string('productivity_rating')->nullable();
            $table->text('performance_comments')->nullable();

            // Part C - Attendance & Reliability
            $table->string('punctuality')->nullable();
            $table->string('attendance')->nullable();
            $table->boolean('excessive_sick_leave')->default(false);
            $table->text('sick_leave_details')->nullable();

            // Part D - WHS & Site Compliance
            $table->string('safety_attitude')->nullable();
            $table->string('swms_compliance')->nullable();
            $table->string('ppe_compliance')->nullable();
            $table->string('prestart_toolbox_attendance')->nullable();
            $table->boolean('has_incidents')->default(false);
            $table->text('incident_details')->nullable();

            // Part E - Behaviour & Conduct
            $table->string('workplace_behaviour')->nullable();
            $table->string('attitude_towards_foreman')->nullable();
            $table->string('attitude_towards_coworkers')->nullable();
            $table->boolean('has_disciplinary_actions')->default(false);
            $table->text('disciplinary_details')->nullable();
            $table->json('concerns')->nullable();
            $table->text('concerns_details')->nullable();

            // Part F/G notes (actual data pulled from injuries table at display time)
            $table->text('injury_review_notes')->nullable();

            // Part H - Skills & Role Suitability (Receiving Foreman)
            $table->string('position_applying_for')->nullable();
            $table->string('position_other')->nullable();
            $table->string('suitable_for_tasks')->nullable();
            $table->string('primary_skillset')->nullable();
            $table->string('primary_skillset_other')->nullable();
            $table->boolean('has_required_tools')->nullable();
            $table->boolean('tools_tagged')->nullable();

            // Part I - Internal Reference Check (Receiving Foreman)
            $table->string('would_have_worker_again')->nullable();
            $table->text('rehire_conditions')->nullable();
            $table->text('main_strengths')->nullable();
            $table->text('areas_for_improvement')->nullable();

            // Part J - Final Recommendations
            $table->string('current_foreman_recommendation')->nullable();
            $table->text('current_foreman_comments')->nullable();
            $table->timestamp('current_foreman_signed_at')->nullable();

            $table->string('safety_manager_recommendation')->nullable();
            $table->text('safety_manager_comments')->nullable();
            $table->foreignId('safety_manager_id')->nullable()->constrained('users');
            $table->timestamp('safety_manager_signed_at')->nullable();

            $table->string('receiving_foreman_recommendation')->nullable();
            $table->text('receiving_foreman_comments')->nullable();
            $table->timestamp('receiving_foreman_signed_at')->nullable();

            $table->string('construction_manager_decision')->nullable();
            $table->text('construction_manager_comments')->nullable();
            $table->foreignId('construction_manager_id')->nullable()->constrained('users');
            $table->timestamp('construction_manager_signed_at')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_transfers');
    }
};
