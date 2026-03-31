<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_tasks', function (Blueprint $table) {
            if (!Schema::hasColumn('project_tasks', 'color')) {
                $table->string('color', 7)->nullable()->after('progress');
            }
            if (!Schema::hasColumn('project_tasks', 'is_critical')) {
                $table->boolean('is_critical')->default(false)->after('color');
            }
        });
    }

    public function down(): void
    {
        Schema::table('project_tasks', function (Blueprint $table) {
            $table->dropColumn(['color', 'is_critical']);
        });
    }
};
