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
        Schema::create('ap_posted_invoices', function (Blueprint $table) {
            $table->id();
            $table->string('client_id')->nullable();
            $table->string('company')->nullable();
            $table->string('vendor_code')->nullable();
            $table->string('vendor')->nullable();
            $table->string('invoice_number')->nullable();
            $table->string('unique_id')->nullable()->index();
            $table->string('job_number')->nullable();
            $table->string('po_number')->nullable();
            $table->string('sub_number')->nullable();
            $table->date('invoice_date')->nullable()->index();
            $table->date('due_date')->nullable();
            $table->date('received_date')->nullable();
            $table->date('transaction_date')->nullable();
            $table->decimal('subtotal', 18, 4)->nullable();
            $table->decimal('tax1', 18, 4)->nullable();
            $table->decimal('tax2', 18, 4)->nullable();
            $table->decimal('freight', 18, 4)->nullable();
            $table->decimal('discount', 18, 4)->nullable();
            $table->decimal('retainage', 18, 4)->nullable();
            $table->decimal('invoice_total', 18, 4)->nullable();
            $table->string('purchase_category')->nullable();
            $table->string('invoice_status')->nullable()->index();
            $table->string('hold_code')->nullable();
            $table->date('hold_date')->nullable();
            $table->date('release_date')->nullable();
            $table->date('approval_date')->nullable();
            $table->string('approval_status')->nullable();
            $table->text('notes')->nullable();
            $table->text('memo')->nullable();
            $table->string('key')->nullable();
            $table->string('batch')->nullable();
            $table->string('created_by')->nullable();
            $table->timestamps();

            $table->index(['company', 'invoice_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ap_posted_invoices');
    }
};
