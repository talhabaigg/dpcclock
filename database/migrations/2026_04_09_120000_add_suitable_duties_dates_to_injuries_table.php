<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('injuries', function (Blueprint $table) {
            $table->date('suitable_duties_from')->nullable()->after('days_suitable_duties');
            $table->date('suitable_duties_to')->nullable()->after('suitable_duties_from');
        });
    }

    public function down(): void
    {
        Schema::table('injuries', function (Blueprint $table) {
            $table->dropColumn(['suitable_duties_from', 'suitable_duties_to']);
        });
    }
};
