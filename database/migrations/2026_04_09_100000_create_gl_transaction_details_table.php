<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gl_transaction_details', function (Blueprint $table) {
            $table->id();
            $table->integer('client_id')->nullable();
            $table->string('company_code', 20)->nullable();
            $table->date('transaction_date')->nullable();
            $table->string('journal_type', 10)->nullable();
            $table->string('account', 20)->nullable();
            $table->string('account_name')->nullable();
            $table->string('sub_account', 20)->nullable();
            $table->string('sub_account_name')->nullable();
            $table->string('division', 10)->nullable();
            $table->text('description')->nullable();
            $table->decimal('debit', 15, 4)->default(0);
            $table->decimal('credit', 15, 4)->default(0);
            $table->decimal('debit_for_currency', 15, 4)->default(0);
            $table->decimal('credit_for_currency', 15, 4)->default(0);
            $table->string('currency', 10)->nullable();
            $table->string('audit_number', 50)->nullable();
            $table->string('reference_document_number')->nullable();
            $table->boolean('source_is_journal_entry')->default(false);
            $table->string('company_from', 20)->nullable();
            $table->string('company_to', 20)->nullable();
            $table->string('update_user')->nullable();
            $table->datetime('update_date')->nullable();
            $table->timestamps();

            $table->index('transaction_date');
            $table->index('account');
            $table->index('company_code');
            $table->index('journal_type');
            $table->index('audit_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gl_transaction_details');
    }
};
