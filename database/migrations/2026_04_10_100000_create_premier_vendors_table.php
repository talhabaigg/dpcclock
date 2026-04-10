<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('premier_vendors', function (Blueprint $table) {
            $table->id();
            $table->uuid('premier_vendor_id')->unique();
            $table->string('code')->index();
            $table->string('name');
            $table->uuid('ap_subledger_id')->nullable();
            $table->timestamps();
        });

        Schema::create('premier_gl_accounts', function (Blueprint $table) {
            $table->id();
            $table->uuid('premier_account_id')->unique();
            $table->string('account_number')->index();
            $table->string('description')->nullable();
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('premier_vendor_id')->nullable()->after('receive_injury_alerts')
                ->constrained('premier_vendors')->nullOnDelete();
        });

        Schema::table('credit_card_receipts', function (Blueprint $table) {
            $table->string('premier_invoice_id')->nullable()->after('is_reconciled');
            $table->string('invoice_status')->nullable()->after('premier_invoice_id');
            $table->foreignId('gl_account_id')->nullable()->after('invoice_status')
                ->constrained('premier_gl_accounts')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('credit_card_receipts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('gl_account_id');
            $table->dropColumn(['premier_invoice_id', 'invoice_status']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('premier_vendor_id');
        });

        Schema::dropIfExists('premier_gl_accounts');
        Schema::dropIfExists('premier_vendors');
    }
};
