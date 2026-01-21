<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('ap_posted_invoice_lines', function (Blueprint $table) {
            $table->id();
            $table->integer('client_id')->nullable();
            $table->string('company_code')->nullable();
            $table->string('company_name')->nullable();
            $table->string('header_job')->nullable();
            $table->string('purchase_category')->nullable();
            $table->string('sub_contract')->nullable();
            $table->date('transaction_date')->nullable();
            $table->string('invoice_status')->nullable();
            $table->string('ap_subledger')->nullable();
            $table->string('vendor_code')->nullable();
            $table->string('vendor')->nullable();
            $table->string('invoice_number')->nullable();
            $table->string('invoice_unique_id')->nullable();
            $table->integer('line_number')->nullable();
            $table->string('line_company')->nullable();
            $table->string('distribution_type')->nullable();
            $table->string('line_job')->nullable();
            $table->string('cost_item')->nullable();
            $table->string('cost_type')->nullable();
            $table->string('department')->nullable();
            $table->string('location')->nullable();
            $table->string('gl_account')->nullable();
            $table->string('sub_account')->nullable();
            $table->string('division')->nullable();
            $table->string('inventory_subledger')->nullable();
            $table->string('warehouse')->nullable();
            $table->string('warehouse_location')->nullable();
            $table->text('line_description')->nullable();
            $table->decimal('quantity', 15, 6)->nullable();
            $table->string('uofm')->nullable();
            $table->decimal('unit_cost', 15, 6)->nullable();
            $table->decimal('amount', 15, 4)->nullable();
            $table->string('tax_group')->nullable();
            $table->decimal('tax1', 15, 4)->nullable();
            $table->decimal('tax2', 15, 4)->nullable();
            $table->decimal('expense', 15, 4)->nullable();
            $table->string('equipment')->nullable();
            $table->string('occupation')->nullable();
            $table->string('pay_code')->nullable();
            $table->string('item')->nullable();
            $table->timestamps();

            $table->index('line_job');
            $table->index('vendor_code');
            $table->index('invoice_number');
            $table->index('transaction_date');
            $table->index('company_code');
            $table->index('invoice_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ap_posted_invoice_lines');
    }
};
