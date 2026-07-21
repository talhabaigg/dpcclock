<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drawings', function (Blueprint $table) {
            // Aconex's own monotonic version sequence and registration date —
            // the authoritative ordering for imported revisions, replacing
            // guesswork from revision letters. Backend-only (not synced).
            $table->unsignedInteger('aconex_version_number')->nullable()->after('aconex_document_id');
            $table->timestamp('aconex_registered_at')->nullable()->after('aconex_version_number');
        });
    }

    public function down(): void
    {
        Schema::table('drawings', function (Blueprint $table) {
            $table->dropColumn(['aconex_version_number', 'aconex_registered_at']);
        });
    }
};
