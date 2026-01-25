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
        Schema::create('labour_forecast_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('labour_forecast_id')->constrained()->cascadeOnDelete();
            $table->foreignId('location_pay_rate_template_id')->constrained()->cascadeOnDelete();
            $table->date('week_ending');
            $table->unsignedInteger('headcount')->default(0);

            // Snapshot of rates at time of saving (so historical data reflects rates at that time)
            $table->decimal('hourly_rate', 10, 2)->nullable(); // Base hourly rate
            $table->decimal('weekly_cost', 12, 2)->nullable(); // Total weekly cost per person
            $table->json('cost_breakdown_snapshot')->nullable(); // Full cost breakdown JSON

            $table->timestamps();

            // One entry per forecast + template + week
            $table->unique(['labour_forecast_id', 'location_pay_rate_template_id', 'week_ending'], 'lfe_forecast_template_week_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('labour_forecast_entries');
    }
};
