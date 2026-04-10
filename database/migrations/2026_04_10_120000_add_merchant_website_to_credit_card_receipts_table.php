<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('credit_card_receipts', function (Blueprint $table) {
            $table->string('merchant_website')->nullable()->after('merchant_name');
        });
    }

    public function down(): void
    {
        Schema::table('credit_card_receipts', function (Blueprint $table) {
            $table->dropColumn('merchant_website');
        });
    }
};
