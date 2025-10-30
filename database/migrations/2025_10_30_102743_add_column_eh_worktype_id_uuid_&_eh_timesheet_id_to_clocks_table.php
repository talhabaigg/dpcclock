<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('clocks', function (Blueprint $table) {
            $table->unsignedBigInteger('eh_worktype_id')->nullable()->after('eh_location_id');
            $table->string('eh_timesheet_id')->nullable()->after('eh_worktype_id');
            $table->uuid('uuid')->nullable()->after('eh_timesheet_id');
        });
        DB::table('clocks')->get()->each(function ($clock) {
            DB::table('clocks')
                ->where('id', $clock->id)
                ->update(['uuid' => (string) Str::uuid()]);
        });
        Schema::table('clocks', function (Blueprint $table) {
            $table->uuid('uuid')->nullable(false)->change();
        });
    }
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('clocks', function (Blueprint $table) {
            $table->dropColumn(['eh_worktype_id', 'eh_timesheet_id', 'uuid']);
        });
    }
};
