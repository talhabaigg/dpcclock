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
        Schema::create('pay_rate_templates', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('eh_id')->unique();
            $table->string('external_id')->nullable();
            $table->string('name');
            $table->unsignedInteger('primary_pay_category_id')->nullable();
            $table->decimal('super_threshold_amount', 12, 2)->default(0);
            $table->decimal('maximum_quarterly_super_contributions_base', 12, 2)->default(0);
            $table->string('source')->nullable();
            $table->timestamps();
        });

        Schema::create('pay_rate_template_pay_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pay_rate_template_id')->constrained()->onDelete('cascade');
            $table->unsignedInteger('pay_category_id');
            $table->string('pay_category_name')->nullable();
            $table->decimal('user_supplied_rate', 12, 4)->default(0);
            $table->decimal('calculated_rate', 12, 4)->default(0);
            $table->decimal('super_rate', 10, 4)->default(0);
            $table->decimal('standard_weekly_hours', 8, 2)->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pay_rate_template_pay_categories');
        Schema::dropIfExists('pay_rate_templates');
    }
};
