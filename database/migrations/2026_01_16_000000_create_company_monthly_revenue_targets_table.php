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
        Schema::create('company_monthly_revenue_targets', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('fy_year');
            $table->string('month'); // Format: YYYY-MM
            $table->decimal('target_amount', 15, 2)->default(0);
            $table->timestamps();

            $table->unique(['fy_year', 'month'], 'company_revenue_targets_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('company_monthly_revenue_targets');
    }
};
