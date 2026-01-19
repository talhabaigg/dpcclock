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
        Schema::create('vendor_payment_delays', function (Blueprint $table) {
            $table->id();
            $table->string('vendor');
            $table->date('source_month');
            $table->date('payment_month');
            $table->decimal('amount', 12, 2);
            $table->timestamps();

            $table->index(['vendor', 'source_month']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vendor_payment_delays');
    }
};
