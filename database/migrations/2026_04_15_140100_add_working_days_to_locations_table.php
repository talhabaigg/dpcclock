<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            if (!Schema::hasColumn('locations', 'working_days')) {
                // JSON array of JS day-of-week indices (0=Sun..6=Sat). Default Mon-Fri.
                $table->json('working_days')->nullable()->after('state');
            }
        });
    }

    public function down(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            if (Schema::hasColumn('locations', 'working_days')) {
                $table->dropColumn('working_days');
            }
        });
    }
};
