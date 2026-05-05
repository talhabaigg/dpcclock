<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            if (!Schema::hasColumn('locations', 'sell_multiplier_percentage')) {
                $table->decimal('sell_multiplier_percentage', 6, 2)->nullable()->after('master_hourly_rate');
            }
        });
    }

    public function down(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            if (Schema::hasColumn('locations', 'sell_multiplier_percentage')) {
                $table->dropColumn('sell_multiplier_percentage');
            }
        });
    }
};
