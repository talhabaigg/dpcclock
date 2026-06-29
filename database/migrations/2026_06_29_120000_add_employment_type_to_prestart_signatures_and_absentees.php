<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daily_prestart_signatures', function (Blueprint $table) {
            $table->string('employment_type')->nullable()->after('employee_id');
            $table->index('employment_type');
        });

        Schema::table('prestart_absentees', function (Blueprint $table) {
            $table->string('employment_type')->nullable()->after('employee_id');
            $table->index('employment_type');
        });
    }

    public function down(): void
    {
        Schema::table('daily_prestart_signatures', function (Blueprint $table) {
            $table->dropIndex(['employment_type']);
            $table->dropColumn('employment_type');
        });

        Schema::table('prestart_absentees', function (Blueprint $table) {
            $table->dropIndex(['employment_type']);
            $table->dropColumn('employment_type');
        });
    }
};
