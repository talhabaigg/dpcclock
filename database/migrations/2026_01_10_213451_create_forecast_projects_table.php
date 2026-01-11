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
        Schema::create('forecast_projects', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // Project name
            $table->string('project_number')->unique(); // Unique identifier for the forecast project
            $table->text('description')->nullable(); // Optional description
            $table->decimal('total_cost_budget', 15, 2)->default(0); // Total cost budget
            $table->decimal('total_revenue_budget', 15, 2)->default(0); // Total revenue budget
            $table->date('start_date')->nullable(); // Estimated start date
            $table->date('end_date')->nullable(); // Estimated end date
            $table->enum('status', ['potential', 'likely', 'confirmed', 'cancelled'])->default('potential'); // Project status
            $table->timestamps();
            $table->softDeletes(); // Allow soft deletes
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('forecast_projects');
    }
};
