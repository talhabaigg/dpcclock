<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('injuries', function (Blueprint $table) {
            $table->date('days_lost_from')->nullable()->after('work_days_missed');
            $table->date('days_lost_to')->nullable()->after('days_lost_from');
        });
    }

    public function down(): void
    {
        Schema::table('injuries', function (Blueprint $table) {
            $table->dropColumn(['days_lost_from', 'days_lost_to']);
        });
    }
};
