<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_out_adjustments', function (Blueprint $table) {
            $table->id();
            $table->string('job_number');
            $table->string('cost_item');
            $table->string('vendor')->nullable();
            $table->date('source_month');
            $table->date('payment_month');
            $table->decimal('amount', 12, 2);
            $table->timestamps();

            $table->index(['job_number', 'cost_item', 'vendor', 'source_month'], 'cash_out_adj_src_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_out_adjustments');
    }
};
