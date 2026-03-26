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
        Schema::table('signing_requests', function (Blueprint $table) {
            $table->longText('sender_signature')->nullable()->after('custom_fields');
            $table->string('sender_full_name')->nullable()->after('sender_signature');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('signing_requests', function (Blueprint $table) {
            $table->dropColumn(['sender_signature', 'sender_full_name']);
        });
    }
};
