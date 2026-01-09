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
        Schema::create('job_forecast_data', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('location_id');
            $table->string('job_number');
            $table->enum('grid_type', ['cost', 'revenue']);
            $table->string('cost_item');
            $table->string('month'); // Format: YYYY-MM
            $table->decimal('forecast_amount', 15, 2)->nullable();
            $table->timestamps();

            // Indexes
            $table->index(['location_id', 'job_number', 'grid_type']);
            $table->index(['job_number', 'cost_item', 'month']);

            // Unique constraint to prevent duplicate entries
            $table->unique(['job_number', 'grid_type', 'cost_item', 'month'], 'unique_forecast_entry');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('job_forecast_data');
    }
};
