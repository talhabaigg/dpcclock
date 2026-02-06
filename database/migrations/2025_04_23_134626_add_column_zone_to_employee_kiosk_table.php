<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('employee_kiosk', function (Blueprint $table) {
            $table->string('zone')->nullable()->after('eh_employee_id'); // or non-nullable if needed
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employee_kiosk', function (Blueprint $table) {
            $table->dropColumn('zone');
        });
    }
};
