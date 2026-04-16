<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('signing_requests', function (Blueprint $table) {
            $table->boolean('requires_signature')->default(true)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('signing_requests', function (Blueprint $table) {
            $table->dropColumn('requires_signature');
        });
    }
};
