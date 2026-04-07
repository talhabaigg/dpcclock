<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('injuries', function (Blueprint $table) {
            $table->id();
            $table->string('id_formal')->unique();
            $table->foreignId('location_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained()->nullOnDelete();
            $table->string('employee_address')->nullable();
            $table->string('incident');
            $table->string('incident_other')->nullable();
            $table->dateTime('occurred_at')->nullable();
            $table->string('reported_by')->nullable();
            $table->dateTime('reported_at')->nullable();
            $table->string('reported_to')->nullable();
            $table->string('location_of_incident')->nullable();
            $table->text('description')->nullable();
            $table->boolean('emergency_services')->default(false);
            $table->boolean('work_cover_claim')->default(false);
            $table->boolean('treatment')->default(false);
            $table->dateTime('treatment_at')->nullable();
            $table->string('treatment_provider')->nullable();
            $table->string('treatment_external')->nullable();
            $table->string('treatment_external_location')->nullable();
            $table->text('no_treatment_reason')->nullable();
            $table->boolean('follow_up')->nullable();
            $table->text('follow_up_notes')->nullable();
            $table->integer('work_days_missed')->default(0);
            $table->string('report_type')->nullable();
            $table->boolean('witnesses')->default(false);
            $table->text('witness_details')->nullable();
            $table->json('natures')->nullable();
            $table->text('natures_comments')->nullable();
            $table->json('mechanisms')->nullable();
            $table->text('mechanisms_comments')->nullable();
            $table->json('agencies')->nullable();
            $table->text('agencies_comments')->nullable();
            $table->json('contributions')->nullable();
            $table->text('contributions_comments')->nullable();
            $table->json('corrective_actions')->nullable();
            $table->text('corrective_actions_comments')->nullable();
            $table->text('worker_signature')->nullable();
            $table->text('representative_signature')->nullable();
            $table->foreignId('representative_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->string('body_location_image')->nullable();
            $table->dateTime('locked_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['location_id', 'occurred_at']);
            $table->index('incident');
            $table->index('report_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('injuries');
    }
};
