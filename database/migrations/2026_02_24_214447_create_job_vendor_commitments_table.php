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
        Schema::create('job_vendor_commitments', function (Blueprint $table) {
            $table->id();
            $table->string('job_number')->index();
            $table->string('company')->nullable();
            $table->string('vendor')->nullable();
            $table->string('subcontract_no')->nullable();
            $table->string('po_no')->nullable();
            $table->string('approval_status')->nullable();
            $table->string('project_manager')->nullable();
            $table->decimal('original_commitment', 15, 2)->nullable();
            $table->decimal('approved_changes', 15, 2)->nullable();
            $table->decimal('current_commitment', 15, 2)->nullable();
            $table->decimal('total_billed', 15, 2)->nullable();
            $table->decimal('os_commitment', 15, 2)->nullable();
            $table->decimal('invoiced_amount', 15, 2)->nullable();
            $table->decimal('retainage_percent', 10, 4)->nullable();
            $table->decimal('retainage', 15, 2)->nullable();
            $table->decimal('paid_amount', 15, 2)->nullable();
            $table->decimal('ap_balance', 15, 2)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('job_vendor_commitments');
    }
};
