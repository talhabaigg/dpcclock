<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incident_reports', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('report_number')->nullable();
            $table->date('incident_date');
            $table->string('day_of_week', 20)->nullable();
            $table->string('employee_name');
            $table->foreignId('employee_id')->nullable()->constrained()->nullOnDelete();
            $table->string('company')->nullable();
            $table->string('project_name');
            $table->foreignId('location_id')->nullable()->constrained()->nullOnDelete();
            $table->string('position')->nullable();
            $table->string('nature_of_injury')->nullable();
            $table->smallInteger('nature_of_injury_code')->nullable();
            $table->string('body_location')->nullable();
            $table->string('mechanism_of_incident')->nullable();
            $table->string('agency_of_injury')->nullable();
            $table->string('incident_type', 50);
            $table->boolean('workcover_claim')->default(false);
            $table->smallInteger('days_lost')->default(0);
            $table->smallInteger('days_suitable_duties')->default(0);
            $table->decimal('medical_expenses_non_workcover', 10, 2)->default(0);
            $table->string('status', 20)->default('Open');
            $table->text('comments')->nullable();
            // Claims fields (Phase 4 data, included upfront)
            $table->boolean('claim_active')->default(false);
            $table->string('claim_type', 30)->nullable();
            $table->string('claim_status', 20)->nullable();
            $table->string('capacity', 30)->nullable();
            $table->string('employment_status', 30)->nullable();
            $table->decimal('claim_cost', 12, 2)->default(0);
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('incident_date');
            $table->index('project_name');
            $table->index('incident_type');
            $table->index('location_id');
            $table->index('workcover_claim');
            $table->index(['incident_date', 'project_name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incident_reports');
    }
};
