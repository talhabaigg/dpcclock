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
        Schema::create('premier_po_headers', function (Blueprint $table) {
            $table->id();
            $table->uuid('premier_po_id')->unique();
            $table->foreignId('requisition_id')->nullable()->constrained()->nullOnDelete();
            $table->string('po_number', 50)->nullable()->index();
            $table->uuid('vendor_id')->nullable();
            $table->string('vendor_code', 50)->nullable();
            $table->string('vendor_name', 255)->nullable();
            $table->uuid('job_id')->nullable();
            $table->string('job_number', 50)->nullable();
            $table->date('po_date')->nullable();
            $table->date('required_date')->nullable();
            $table->decimal('total_amount', 14, 4)->default(0);
            $table->decimal('invoiced_amount', 14, 4)->default(0);
            $table->string('status', 50)->nullable();
            $table->string('approval_status', 50)->nullable();
            $table->text('description')->nullable();
            $table->json('raw_data')->nullable(); // Store full API response for reference
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('premier_po_headers');
    }
};
