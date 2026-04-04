<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('credit_card_receipts', function (Blueprint $table) {
            if (! Schema::hasColumn('credit_card_receipts', 'currency')) {
                $table->string('currency', 3)->default('AUD')->after('gst_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('credit_card_receipts', function (Blueprint $table) {
            $table->dropColumn('currency');
        });
    }
};
