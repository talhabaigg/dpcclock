<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('injuries', function (Blueprint $table) {
            $table->dateTime('worker_signed_at')->nullable()->after('worker_signature');
            $table->dateTime('representative_signed_at')->nullable()->after('representative_signature');
        });

        // Backfill: for existing rows that already have a signature stored, use created_at
        // as the best available approximation. Future signatures will be stamped accurately.
        DB::statement("UPDATE injuries SET worker_signed_at = created_at WHERE worker_signature IS NOT NULL AND worker_signature != ''");
        DB::statement("UPDATE injuries SET representative_signed_at = created_at WHERE representative_signature IS NOT NULL AND representative_signature != ''");
    }

    public function down(): void
    {
        Schema::table('injuries', function (Blueprint $table) {
            $table->dropColumn(['worker_signed_at', 'representative_signed_at']);
        });
    }
};
