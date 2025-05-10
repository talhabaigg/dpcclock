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
        Schema::create('requisition_line_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('requisition_id')->constrained()->onDelete('cascade');
            $table->integer('serial_number');
            $table->text('description')->nullable();
            $table->string('code')->nullable();
            $table->decimal('unit_cost', 10, 2);
            $table->integer('qty');
            $table->decimal('total_cost', 12, 2);
            $table->string('cost_code')->nullable();
            $table->string('price_list')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('requisition_line_items');
    }
};
