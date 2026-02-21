<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('takeoff_conditions', function (Blueprint $table) {
            if (! Schema::hasColumn('takeoff_conditions', 'opacity')) {
                $table->unsignedTinyInteger('opacity')->default(50)->after('pattern');
            }
        });
    }

    public function down(): void
    {
        Schema::table('takeoff_conditions', function (Blueprint $table) {
            if (Schema::hasColumn('takeoff_conditions', 'opacity')) {
                $table->dropColumn('opacity');
            }
        });
    }
};
