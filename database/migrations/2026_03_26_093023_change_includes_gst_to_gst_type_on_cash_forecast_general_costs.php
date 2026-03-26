<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('cash_forecast_general_costs', function (Blueprint $table) {
            $table->string('gst_type', 20)->default('inclusive')->after('includes_gst');
        });

        // Migrate existing data
        DB::table('cash_forecast_general_costs')
            ->where('includes_gst', true)
            ->update(['gst_type' => 'inclusive']);

        DB::table('cash_forecast_general_costs')
            ->where('includes_gst', false)
            ->update(['gst_type' => 'exclusive']);

        Schema::table('cash_forecast_general_costs', function (Blueprint $table) {
            $table->dropColumn('includes_gst');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cash_forecast_general_costs', function (Blueprint $table) {
            $table->boolean('includes_gst')->default(true)->after('amount');
        });

        DB::table('cash_forecast_general_costs')
            ->where('gst_type', 'inclusive')
            ->update(['includes_gst' => true]);

        DB::table('cash_forecast_general_costs')
            ->whereIn('gst_type', ['exclusive', 'free'])
            ->update(['includes_gst' => false]);

        Schema::table('cash_forecast_general_costs', function (Blueprint $table) {
            $table->dropColumn('gst_type');
        });
    }
};
