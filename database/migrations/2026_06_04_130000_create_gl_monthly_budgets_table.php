<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gl_monthly_budgets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('premier_gl_account_id')->constrained('premier_gl_accounts')->cascadeOnDelete();
            $table->unsignedInteger('fy_year');
            $table->string('month', 7); // YYYY-MM
            $table->decimal('budget_amount', 15, 2)->default(0);
            $table->timestamps();

            $table->unique(['premier_gl_account_id', 'fy_year', 'month'], 'gl_monthly_budgets_unique');
            $table->index(['fy_year', 'month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gl_monthly_budgets');
    }
};
