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
        Schema::create('forecast_project_revenue_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('forecast_project_id')->constrained()->onDelete('cascade');
            $table->string('cost_item'); // Using same naming convention as existing system
            $table->string('cost_item_description')->nullable(); // Description of the revenue item
            $table->decimal('contract_sum_to_date', 15, 2)->default(0); // Final revenue amount (using existing naming convention)
            $table->integer('display_order')->default(0); // Order for displaying items
            $table->timestamps();

            // Ensure unique revenue items per project
            $table->unique(['forecast_project_id', 'cost_item'], 'fp_revenue_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('forecast_project_revenue_items');
    }
};
