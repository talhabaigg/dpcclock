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
        Schema::create('pay_categories', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('eh_id')->unique();
            $table->string('external_id')->nullable();
            $table->string('name');
            $table->string('pay_category_type')->nullable();
            $table->string('rate_unit')->nullable();
            $table->boolean('accrues_leave')->default(false);
            $table->boolean('is_tax_exempt')->default(false);
            $table->boolean('is_payroll_tax_exempt')->default(false);
            $table->boolean('is_primary')->default(false);
            $table->boolean('is_system_pay_category')->default(false);
            $table->decimal('rate_loading_percent', 10, 4)->default(0);
            $table->decimal('penalty_loading_percent', 10, 4)->default(0);
            $table->decimal('default_super_rate', 10, 4)->default(0);
            $table->unsignedInteger('parent_id')->nullable();
            $table->unsignedInteger('award_id')->nullable();
            $table->string('award_name')->nullable();
            $table->string('payment_summary_classification')->nullable();
            $table->boolean('hide_units_on_pay_slip')->default(false);
            $table->unsignedInteger('number_of_decimal_places')->nullable();
            $table->string('rounding_method')->nullable();
            $table->string('general_ledger_mapping_code')->nullable();
            $table->string('super_expense_mapping_code')->nullable();
            $table->string('super_liability_mapping_code')->nullable();
            $table->text('allowance_description')->nullable();
            $table->string('source')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pay_categories');
    }
};
