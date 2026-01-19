<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_in_adjustments', function (Blueprint $table) {
            $table->id();
            $table->string('job_number');
            $table->date('source_month');
            $table->date('receipt_month');
            $table->decimal('amount', 12, 2);
            $table->timestamps();

            $table->index(['job_number', 'source_month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_in_adjustments');
    }
};
