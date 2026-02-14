<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drawing_measurements', function (Blueprint $table) {
            if (!Schema::hasColumn('drawing_measurements', 'perimeter_value')) {
                $table->decimal('perimeter_value', 16, 4)->nullable()->after('computed_value');
            }
        });
    }

    public function down(): void
    {
        Schema::table('drawing_measurements', function (Blueprint $table) {
            if (Schema::hasColumn('drawing_measurements', 'perimeter_value')) {
                $table->dropColumn('perimeter_value');
            }
        });
    }
};
