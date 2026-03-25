<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employment_application_reference_checks', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('employment_application_reference_id');
            $table->foreign('employment_application_reference_id', 'ref_checks_ref_id_foreign')
                ->references('id')->on('employment_application_references')->cascadeOnDelete();

            $table->unsignedBigInteger('employment_application_id');
            $table->foreign('employment_application_id', 'ref_checks_app_id_foreign')
                ->references('id')->on('employment_applications')->cascadeOnDelete();

            $table->unsignedBigInteger('completed_by')->nullable();
            $table->foreign('completed_by', 'ref_checks_completed_by_foreign')
                ->references('id')->on('users')->nullOnDelete();
            $table->datetime('completed_at')->nullable();

            // Referee contact details
            $table->string('referee_current_job_title')->nullable();
            $table->string('referee_current_employer')->nullable();
            $table->string('telephone')->nullable();
            $table->string('email')->nullable();
            $table->boolean('prepared_to_provide_reference')->nullable();

            // Part B — Employment details
            $table->date('employment_from')->nullable();
            $table->date('employment_to')->nullable();
            $table->boolean('dates_align')->nullable();
            $table->string('relationship')->nullable();
            $table->string('relationship_duration')->nullable();
            $table->string('company_at_time')->nullable();
            $table->string('applicant_job_title')->nullable();
            $table->string('applicant_job_title_other')->nullable();
            $table->json('duties')->nullable();
            $table->string('performance_rating')->nullable();
            $table->string('honest_work_ethic')->nullable();
            $table->string('punctual')->nullable();
            $table->string('sick_days')->nullable();
            $table->text('reason_for_leaving')->nullable();

            // Part C — Closing questions
            $table->text('greatest_strengths')->nullable();
            $table->string('would_rehire')->nullable();

            // Part D — Completed by
            $table->string('completed_by_name')->nullable();
            $table->string('completed_by_position')->nullable();
            $table->date('completed_date')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employment_application_reference_checks');
    }
};
