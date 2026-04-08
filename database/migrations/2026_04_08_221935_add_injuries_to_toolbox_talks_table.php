<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('toolbox_talks', function (Blueprint $table) {
            $table->json('injuries')->nullable()->after('action_points');
        });
    }

    public function down(): void
    {
        Schema::table('toolbox_talks', function (Blueprint $table) {
            $table->dropColumn('injuries');
        });
    }
};
