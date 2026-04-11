<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pay_runs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('eh_pay_run_id')->unique();
            $table->date('pay_period_starting')->nullable();
            $table->date('pay_period_ending')->nullable();
            $table->date('date_paid')->nullable();
            $table->string('status')->nullable();
            $table->boolean('leave_accruals_synced')->default(false);
            $table->timestamps();

            $table->index('pay_period_ending');
        });

        Schema::create('pay_run_leave_accruals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pay_run_id')->constrained('pay_runs')->cascadeOnDelete();
            $table->string('eh_employee_id');
            $table->string('leave_category_id')->nullable();
            $table->string('leave_category_name')->nullable();
            $table->string('accrual_type')->nullable();
            $table->decimal('amount', 10, 4)->default(0);
            $table->string('notes')->nullable();
            $table->timestamps();

            $table->index(['eh_employee_id', 'leave_category_name']);
            $table->index('leave_category_name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pay_run_leave_accruals');
        Schema::dropIfExists('pay_runs');
    }
};
