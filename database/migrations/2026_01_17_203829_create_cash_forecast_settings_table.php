<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Cash forecast settings (starting balance, etc.)
        Schema::create('cash_forecast_settings', function (Blueprint $table) {
            $table->id();
            $table->decimal('starting_balance', 15, 2)->default(0);
            $table->date('starting_balance_date')->nullable();
            $table->timestamps();
        });

        // General costs (overhead, recurring expenses, one-off costs)
        Schema::create('cash_forecast_general_costs', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('description')->nullable();
            $table->enum('type', ['one_off', 'recurring'])->default('one_off');
            $table->decimal('amount', 15, 2);
            $table->boolean('includes_gst')->default(false);
            $table->enum('frequency', ['weekly', 'fortnightly', 'monthly', 'quarterly', 'annually'])->nullable();
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->string('category')->nullable(); // rent, utilities, insurance, etc.
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_forecast_general_costs');
        Schema::dropIfExists('cash_forecast_settings');
    }
};
