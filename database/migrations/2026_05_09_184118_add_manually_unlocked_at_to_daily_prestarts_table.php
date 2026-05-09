<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daily_prestarts', function (Blueprint $table) {
            $table->dateTime('manually_unlocked_at')->nullable()->after('locked_at');
        });
    }

    public function down(): void
    {
        Schema::table('daily_prestarts', function (Blueprint $table) {
            $table->dropColumn('manually_unlocked_at');
        });
    }
};
