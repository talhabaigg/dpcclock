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
        Schema::create('oncosts', function (Blueprint $table) {
            $table->id();
            $table->string('name');                                    // e.g., "Superannuation", "BERT"
            $table->string('code', 50)->unique();                      // e.g., "SUPER", "BERT"
            $table->text('description')->nullable();
            $table->decimal('weekly_amount', 10, 2);                   // e.g., 310.00
            $table->decimal('hourly_rate', 10, 4)                      // Auto-calculated: weekly / 40
                ->storedAs('weekly_amount / 40');
            $table->boolean('is_percentage')->default(false);          // True for payroll tax, workcover
            $table->decimal('percentage_rate', 5, 4)->nullable();      // e.g., 0.0495 for 4.95%
            $table->boolean('applies_to_overtime')->default(false);    // Whether to apply to OT hours
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('oncosts');
    }
};
