<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_file_types', function (Blueprint $table) {
            $table->string('category')->nullable()->after('name');
        });

        // Remove the manual 'name' column from employee_files — name comes from the file type
        Schema::table('employee_files', function (Blueprint $table) {
            $table->dropColumn('name');
        });
    }

    public function down(): void
    {
        Schema::table('employee_files', function (Blueprint $table) {
            $table->string('name')->after('employee_file_type_id');
        });

        Schema::table('employee_file_types', function (Blueprint $table) {
            $table->dropColumn('category');
        });
    }
};
