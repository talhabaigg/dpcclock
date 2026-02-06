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
        Schema::create('variation_line_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('variation_id')->constrained('variations')->onDelete('cascade');
            $table->bigInteger('line_number'); // Assuming line_number is a big integer, adjust as necessary
            $table->string('description')->nullable(); // Description of the line item
            $table->decimal('qty', 10, 2); // Quantity of the item
            $table->decimal('unit_cost', 10, 2); // Unit price of
            $table->decimal('total_cost', 10, 2);
            $table->string('cost_item')->nullable(); // Cost item description or code
            $table->string('cost_type')->nullable(); // Type of cost, e.g., labor, material, etc.
            $table->decimal('revenue', 10, 2);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('variation_line_items');
    }
};
