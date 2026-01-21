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
        Schema::create('ar_posted_invoices', function (Blueprint $table) {
            $table->id();
            $table->integer('client_id')->nullable();
            $table->string('company')->nullable();
            $table->string('contract_customer_code')->nullable();
            $table->string('contract_customer_name')->nullable();
            $table->string('mail_to_customer_code')->nullable();
            $table->string('mail_to_customer_name')->nullable();
            $table->string('bill_to_customer_code')->nullable();
            $table->string('bill_to_customer_name')->nullable();
            $table->string('job_number')->nullable();
            $table->string('job_name')->nullable();
            $table->string('invoice_number')->nullable();
            $table->date('invoice_date')->nullable();
            $table->date('due_date')->nullable();
            $table->date('transaction_date')->nullable();
            $table->decimal('subtotal', 15, 4)->nullable();
            $table->decimal('tax1', 15, 4)->nullable();
            $table->decimal('tax2', 15, 4)->nullable();
            $table->decimal('freight', 15, 4)->nullable();
            $table->decimal('discount', 15, 4)->nullable();
            $table->decimal('retainage', 15, 4)->nullable();
            $table->decimal('total', 15, 4)->nullable();
            $table->string('sales_category')->nullable();
            $table->text('memo')->nullable();
            $table->string('invoice_status')->nullable();
            $table->string('key')->nullable();
            $table->string('ar_subledger_code')->nullable();
            $table->string('currency_code')->nullable();
            $table->timestamps();

            $table->index('job_number');
            $table->index('contract_customer_code');
            $table->index('invoice_date');
            $table->index('company');
            $table->index('invoice_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ar_posted_invoices');
    }
};
