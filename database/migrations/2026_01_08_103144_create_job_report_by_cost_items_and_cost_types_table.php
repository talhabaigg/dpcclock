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
        Schema::create('job_report_by_cost_items_and_cost_types', function (Blueprint $table) {
            $table->id();
            $table->string('job_number')->nullable();
            $table->string('cost_item')->nullable();
            $table->float('original_estimate')->nullable();
            $table->float('current_estimate')->nullable();
            $table->float('estimate_at_completion')->nullable();
            $table->float('estimate_to_completion')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('job_report_by_cost_items_and_cost_types');
    }
};
