<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('toolbox_talk_attendees', function (Blueprint $table) {
            $table->timestamp('signed_at')->nullable()->after('signed');
            $table->timestamp('acknowledged_at')->nullable()->after('signed_at');
            $table->string('signature_path')->nullable()->after('acknowledged_at');
            $table->string('source', 16)->nullable()->after('signature_path');
        });
    }

    public function down(): void
    {
        Schema::table('toolbox_talk_attendees', function (Blueprint $table) {
            $table->dropColumn(['signed_at', 'acknowledged_at', 'signature_path', 'source']);
        });
    }
};
