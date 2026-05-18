<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('takeoff_conditions', function (Blueprint $table) {
            if (! Schema::hasColumn('takeoff_conditions', 'sell_rate')) {
                $table->decimal('sell_rate', 12, 4)->nullable()->after('labour_unit_rate');
            }
        });
    }

    public function down(): void
    {
        Schema::table('takeoff_conditions', function (Blueprint $table) {
            if (Schema::hasColumn('takeoff_conditions', 'sell_rate')) {
                $table->dropColumn('sell_rate');
            }
        });
    }
};
