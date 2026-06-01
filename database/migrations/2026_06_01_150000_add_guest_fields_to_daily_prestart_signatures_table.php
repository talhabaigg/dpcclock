<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the FKs that depend on the composite unique index, then the index,
        // then make employee_id nullable and add guest fields. Re-add FKs and the
        // unique. NULL employee_id rows are treated as distinct by both MySQL and
        // SQLite, which is exactly what we want — many guests per prestart.
        Schema::table('daily_prestart_signatures', function (Blueprint $table) {
            $table->dropForeign(['daily_prestart_id']);
            $table->dropForeign(['employee_id']);
        });

        Schema::table('daily_prestart_signatures', function (Blueprint $table) {
            $table->dropUnique(['daily_prestart_id', 'employee_id']);
        });

        Schema::table('daily_prestart_signatures', function (Blueprint $table) {
            $table->unsignedBigInteger('employee_id')->nullable()->change();
            $table->string('guest_name')->nullable()->after('employee_id');
            $table->string('guest_company')->nullable()->after('guest_name');

            $table->foreign('daily_prestart_id')->references('id')->on('daily_prestarts')->cascadeOnDelete();
            $table->foreign('employee_id')->references('id')->on('employees')->cascadeOnDelete();

            $table->unique(
                ['daily_prestart_id', 'employee_id'],
                'daily_prestart_signatures_prestart_employee_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('daily_prestart_signatures', function (Blueprint $table) {
            $table->dropForeign(['daily_prestart_id']);
            $table->dropForeign(['employee_id']);
        });

        Schema::table('daily_prestart_signatures', function (Blueprint $table) {
            $table->dropUnique('daily_prestart_signatures_prestart_employee_unique');
        });

        Schema::table('daily_prestart_signatures', function (Blueprint $table) {
            $table->dropColumn(['guest_name', 'guest_company']);
        });

        Schema::table('daily_prestart_signatures', function (Blueprint $table) {
            $table->unsignedBigInteger('employee_id')->nullable(false)->change();
            $table->foreign('daily_prestart_id')->references('id')->on('daily_prestarts')->cascadeOnDelete();
            $table->foreign('employee_id')->references('id')->on('employees')->cascadeOnDelete();
            $table->unique(['daily_prestart_id', 'employee_id']);
        });
    }
};
