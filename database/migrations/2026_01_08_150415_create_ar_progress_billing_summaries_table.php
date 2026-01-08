<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('ar_progress_billing_summaries', function (Blueprint $table) {
            $table->id();
            $table->string('job_number')->nullable();
            $table->string('application_number')->nullable();
            $table->string('description')->nullable();
            $table->date('from_date')->nullable();
            $table->date('period_end_date')->nullable();
            $table->string(('status_name'))->nullable();
            $table->float('this_app_work_completed')->nullable();
            $table->float('contract_sum_to_date')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ar_progress_billing_summaries');
    }
};
