<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('signing_requests', function (Blueprint $table) {
            $table->foreignId('internal_signer_user_id')->nullable()->after('sender_position')->constrained('users')->nullOnDelete();
            $table->string('internal_signer_token', 64)->nullable()->unique()->after('internal_signer_user_id');
            $table->timestamp('internal_signed_at')->nullable()->after('internal_signer_token');
        });
    }

    public function down(): void
    {
        Schema::table('signing_requests', function (Blueprint $table) {
            $table->dropForeign(['internal_signer_user_id']);
            $table->dropColumn(['internal_signer_user_id', 'internal_signer_token', 'internal_signed_at']);
        });
    }
};
