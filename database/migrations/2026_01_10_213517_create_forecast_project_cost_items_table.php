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
        Schema::create('forecast_project_cost_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('forecast_project_id')->constrained()->onDelete('cascade');
            $table->string('cost_item'); // Cost code (e.g., "01-01")
            $table->string('cost_item_description')->nullable(); // Description of the cost item
            $table->decimal('budget', 15, 2)->default(0); // Budget amount for this cost item
            $table->integer('display_order')->default(0); // Order for displaying items
            $table->timestamps();

            // Ensure unique cost items per project
            $table->unique(['forecast_project_id', 'cost_item'], 'fp_cost_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('forecast_project_cost_items');
    }
};
