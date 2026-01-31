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
        Schema::create('premier_po_lines', function (Blueprint $table) {
            $table->id();

            // Premier IDs
            $table->uuid('premier_line_id')->unique(); // PurchaseOrderLineId
            $table->uuid('premier_po_id')->index(); // PurchaseOrderId

            // Link to local requisition
            $table->foreignId('requisition_id')->nullable()->constrained()->nullOnDelete();

            // Line data
            $table->integer('line_number'); // Line
            $table->text('description'); // LineDescription
            $table->decimal('quantity', 14, 4)->default(0);
            $table->decimal('unit_cost', 14, 6)->default(0);
            $table->decimal('amount', 14, 4)->default(0); // Total
            $table->decimal('invoice_balance', 14, 4)->default(0);

            // Premier reference IDs (for potential lookups)
            $table->uuid('cost_item_id')->nullable();
            $table->uuid('cost_type_id')->nullable();
            $table->uuid('job_id')->nullable();
            $table->uuid('item_id')->nullable();

            // Sync metadata
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();

            // Composite index for requisition lookups
            $table->index(['requisition_id', 'premier_po_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('premier_po_lines');
    }
};
