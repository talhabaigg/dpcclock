<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Locations (projects)
        Schema::table('locations', function (Blueprint $table) {
            $table->string('watermelon_id', 36)->nullable()->unique()->after('id');
        });

        // Drawings
        Schema::table('drawings', function (Blueprint $table) {
            $table->string('watermelon_id', 36)->nullable()->unique()->after('id');
        });

        // Drawing observations
        Schema::table('drawing_observations', function (Blueprint $table) {
            $table->string('watermelon_id', 36)->nullable()->unique()->after('id');
        });
    }

    public function down(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->dropColumn('watermelon_id');
        });

        Schema::table('drawings', function (Blueprint $table) {
            $table->dropColumn('watermelon_id');
        });

        Schema::table('drawing_observations', function (Blueprint $table) {
            $table->dropColumn('watermelon_id');
        });
    }
};
