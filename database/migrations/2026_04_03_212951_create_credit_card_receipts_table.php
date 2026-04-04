<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credit_card_receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('merchant_name')->nullable();
            $table->decimal('total_amount', 10, 2)->nullable();
            $table->decimal('gst_amount', 10, 2)->nullable();
            $table->date('transaction_date')->nullable();
            $table->string('card_last_four', 4)->nullable();
            $table->string('category')->nullable();
            $table->text('description')->nullable();
            $table->string('extraction_status')->default('pending');
            $table->json('raw_extraction')->nullable();
            $table->timestamps();

            $table->index('transaction_date');
            $table->index('total_amount');
            $table->index('category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credit_card_receipts');
    }
};
