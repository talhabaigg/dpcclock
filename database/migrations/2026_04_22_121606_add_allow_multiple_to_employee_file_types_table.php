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
        Schema::table('employee_file_types', function (Blueprint $table) {
            $table->boolean('allow_multiple')->default(false)->after('requires_completed_date');
        });
    }

    public function down(): void
    {
        Schema::table('employee_file_types', function (Blueprint $table) {
            $table->dropColumn('allow_multiple');
        });
    }
};
