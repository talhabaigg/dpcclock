<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $database = DB::connection()->getDatabaseName();

        $hasForeignKey = function (string $name) use ($database): bool {
            return (bool) DB::selectOne(
                'SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = ?',
                [$database, 'daily_prestart_signatures', $name, 'FOREIGN KEY']
            );
        };

        $hasIndex = function (string $name) use ($database): bool {
            return (bool) DB::selectOne(
                'SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
                 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?',
                [$database, 'daily_prestart_signatures', $name]
            );
        };

        $hasColumn = fn (string $col) => Schema::hasColumn('daily_prestart_signatures', $col);

        // Drop dependent FKs first (only if present).
        if ($hasForeignKey('daily_prestart_signatures_daily_prestart_id_foreign')) {
            Schema::table('daily_prestart_signatures', fn (Blueprint $t) => $t->dropForeign(['daily_prestart_id']));
        }
        if ($hasForeignKey('daily_prestart_signatures_employee_id_foreign')) {
            Schema::table('daily_prestart_signatures', fn (Blueprint $t) => $t->dropForeign(['employee_id']));
        }

        // Drop the composite unique (if present) so we can make employee_id nullable.
        if ($hasIndex('daily_prestart_signatures_daily_prestart_id_employee_id_unique')) {
            Schema::table('daily_prestart_signatures', fn (Blueprint $t) => $t->dropUnique(['daily_prestart_id', 'employee_id']));
        }

        // Make employee_id nullable + add guest fields.
        Schema::table('daily_prestart_signatures', function (Blueprint $table) use ($hasColumn) {
            $table->unsignedBigInteger('employee_id')->nullable()->change();

            if (! $hasColumn('guest_name')) {
                $table->string('guest_name')->nullable()->after('employee_id');
            }
            if (! $hasColumn('guest_company')) {
                $table->string('guest_company')->nullable()->after('guest_name');
            }
        });

        // Re-add FKs.
        Schema::table('daily_prestart_signatures', function (Blueprint $table) {
            $table->foreign('daily_prestart_id')->references('id')->on('daily_prestarts')->cascadeOnDelete();
            $table->foreign('employee_id')->references('id')->on('employees')->cascadeOnDelete();
        });

        // Re-add unique. MySQL treats NULL employee_id rows as distinct,
        // so multiple guest signatures per prestart are allowed.
        if (! $hasIndex('daily_prestart_signatures_prestart_employee_unique')) {
            DB::statement('
                CREATE UNIQUE INDEX daily_prestart_signatures_prestart_employee_unique
                ON daily_prestart_signatures (daily_prestart_id, employee_id)
            ');
        }
    }

    public function down(): void
    {
        Schema::table('daily_prestart_signatures', function (Blueprint $table) {
            $table->dropForeign(['daily_prestart_id']);
            $table->dropForeign(['employee_id']);
        });

        DB::statement('DROP INDEX daily_prestart_signatures_prestart_employee_unique ON daily_prestart_signatures');

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
