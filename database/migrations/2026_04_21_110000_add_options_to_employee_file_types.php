<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_file_types', function (Blueprint $table) {
            $table->json('options')->nullable()->after('requires_completed_date');
        });

        Schema::table('employee_files', function (Blueprint $table) {
            $table->json('selected_options')->nullable()->after('completed_at');
        });
    }

    public function down(): void
    {
        Schema::table('employee_file_types', function (Blueprint $table) {
            $table->dropColumn('options');
        });

        Schema::table('employee_files', function (Blueprint $table) {
            $table->dropColumn('selected_options');
        });
    }
};
