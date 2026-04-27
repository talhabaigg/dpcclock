<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('project_tasks', 'uuid')) {
            Schema::table('project_tasks', function (Blueprint $table) {
                $table->char('uuid', 36)->nullable()->after('id');
            });
        }

        DB::table('project_tasks')
            ->whereNull('uuid')
            ->orderBy('id')
            ->chunkById(1000, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('project_tasks')
                        ->where('id', $row->id)
                        ->update(['uuid' => (string) Str::uuid()]);
                }
            });

        $hasUnique = collect(DB::select(
            "SELECT INDEX_NAME FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_tasks' AND INDEX_NAME = 'project_tasks_uuid_unique'"
        ))->isNotEmpty();

        if (!$hasUnique) {
            Schema::table('project_tasks', function (Blueprint $table) {
                $table->unique('uuid');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('project_tasks', 'uuid')) {
            Schema::table('project_tasks', function (Blueprint $table) {
                $table->dropUnique('project_tasks_uuid_unique');
                $table->dropColumn('uuid');
            });
        }
    }
};
