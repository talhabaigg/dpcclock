<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('signing_requests', function (Blueprint $table) {
            $table->string('document_title')->nullable()->after('document_template_id');
        });
    }

    public function down(): void
    {
        Schema::table('signing_requests', function (Blueprint $table) {
            $table->dropColumn('document_title');
        });
    }
};
