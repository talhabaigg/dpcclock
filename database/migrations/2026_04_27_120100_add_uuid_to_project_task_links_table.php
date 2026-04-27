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
        if (!Schema::hasColumn('project_task_links', 'uuid')) {
            Schema::table('project_task_links', function (Blueprint $table) {
                $table->char('uuid', 36)->nullable()->after('id');
            });
        }

        DB::table('project_task_links')
            ->whereNull('uuid')
            ->orderBy('id')
            ->chunkById(1000, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('project_task_links')
                        ->where('id', $row->id)
                        ->update(['uuid' => (string) Str::uuid()]);
                }
            });

        if (!Schema::hasIndex('project_task_links', 'project_task_links_uuid_unique')) {
            Schema::table('project_task_links', function (Blueprint $table) {
                $table->unique('uuid');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('project_task_links', 'uuid')) {
            Schema::table('project_task_links', function (Blueprint $table) {
                if (Schema::hasIndex('project_task_links', 'project_task_links_uuid_unique')) {
                    $table->dropUnique('project_task_links_uuid_unique');
                }
                $table->dropColumn('uuid');
            });
        }
    }
};
