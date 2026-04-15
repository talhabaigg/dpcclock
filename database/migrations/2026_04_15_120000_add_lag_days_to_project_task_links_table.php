<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_task_links', function (Blueprint $table) {
            // Signed: positive = lag (delay), negative = lead (overlap). Calendar days.
            $table->smallInteger('lag_days')->default(0)->after('type');
        });
    }

    public function down(): void
    {
        Schema::table('project_task_links', function (Blueprint $table) {
            $table->dropColumn('lag_days');
        });
    }
};
