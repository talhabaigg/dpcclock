<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('site_walk_photos', function (Blueprint $table) {
            $table->json('hotspot_overrides')->nullable()->after('photo_size');
        });
    }

    public function down(): void
    {
        Schema::table('site_walk_photos', function (Blueprint $table) {
            $table->dropColumn('hotspot_overrides');
        });
    }
};
