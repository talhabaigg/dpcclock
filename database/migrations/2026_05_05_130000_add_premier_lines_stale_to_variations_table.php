<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('variations', function (Blueprint $table) {
            if (! Schema::hasColumn('variations', 'premier_lines_stale')) {
                $table->boolean('premier_lines_stale')->default(true)->after('client_notes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('variations', function (Blueprint $table) {
            if (Schema::hasColumn('variations', 'premier_lines_stale')) {
                $table->dropColumn('premier_lines_stale');
            }
        });
    }
};
