<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('variations', function (Blueprint $table) {
            if (!Schema::hasColumn('variations', 'extra_days')) {
                $table->integer('extra_days')->nullable()->after('client_notes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('variations', function (Blueprint $table) {
            if (Schema::hasColumn('variations', 'extra_days')) {
                $table->dropColumn('extra_days');
            }
        });
    }
};
