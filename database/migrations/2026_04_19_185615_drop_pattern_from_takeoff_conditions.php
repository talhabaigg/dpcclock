<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasColumn('takeoff_conditions', 'pattern')) {
            Schema::table('takeoff_conditions', function (Blueprint $table) {
                $table->dropColumn('pattern');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('takeoff_conditions', 'pattern')) {
            Schema::table('takeoff_conditions', function (Blueprint $table) {
                $table->string('pattern')->default('solid')->after('color');
            });
        }
    }
};
