<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drawings', function (Blueprint $table) {
            // Aconex version-specific document id this drawing was imported
            // from. Backend-only provenance (not exposed to mobile sync):
            // used to dedupe re-imports and to check Aconex for new revisions.
            $table->string('aconex_document_id', 50)->nullable()->after('previous_revision_id')->index();
        });
    }

    public function down(): void
    {
        Schema::table('drawings', function (Blueprint $table) {
            $table->dropIndex(['aconex_document_id']);
            $table->dropColumn('aconex_document_id');
        });
    }
};
