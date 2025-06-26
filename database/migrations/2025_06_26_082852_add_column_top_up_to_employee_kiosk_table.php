<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('employee_kiosk', function (Blueprint $table) {
            $table->boolean('top_up')->default(false)->after('zone'); // Adding top_up column
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employee_kiosk', function (Blueprint $table) {
            $table->dropColumn('top_up'); // Dropping top_up column
        });
    }
};
