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
        Schema::table('ai_chat_messages', function (Blueprint $table) {
            $table->integer('input_tokens')->nullable()->after('tokens_used');
            $table->integer('output_tokens')->nullable()->after('input_tokens');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ai_chat_messages', function (Blueprint $table) {
            $table->dropColumn(['input_tokens', 'output_tokens']);
        });
    }
};
