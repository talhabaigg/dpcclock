<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drawing_measurements', function (Blueprint $table) {
            // GUID is the cross-file stable identifier from OST (BidTakeoff.GUID).
            // Production imports key off this so progress survives takeoff re-imports.
            $table->string('ost_guid', 64)->nullable()->after('watermelon_id');
            $table->unsignedInteger('ost_uid')->nullable()->after('ost_guid');
            $table->index('ost_guid', 'drawing_measurements_ost_guid_idx');
        });
    }

    public function down(): void
    {
        Schema::table('drawing_measurements', function (Blueprint $table) {
            $table->dropIndex('drawing_measurements_ost_guid_idx');
            $table->dropColumn(['ost_guid', 'ost_uid']);
        });
    }
};
