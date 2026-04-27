<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('project_task_links', 'deleted_at')) {
            Schema::table('project_task_links', function (Blueprint $table) {
                $table->softDeletes();
                $table->index(['location_id', 'updated_at']);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('project_task_links', 'deleted_at')) {
            Schema::table('project_task_links', function (Blueprint $table) {
                $table->dropIndex(['location_id', 'updated_at']);
                $table->dropSoftDeletes();
            });
        }
    }
};
