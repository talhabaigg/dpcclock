<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('checklists', function (Blueprint $table) {
            $table->string('watermelon_id', 36)->nullable()->unique()->after('id');
        });

        Schema::table('checklist_items', function (Blueprint $table) {
            $table->string('watermelon_id', 36)->nullable()->unique()->after('id');
            // QA outcome per item: ok | problem | na. Null = not yet inspected.
            // Nullable so employment-application checklists are unaffected.
            $table->string('status', 10)->nullable()->after('is_required');
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->string('watermelon_id', 36)->nullable()->unique()->after('id');
        });
    }

    public function down(): void
    {
        Schema::table('checklists', function (Blueprint $table) {
            $table->dropColumn('watermelon_id');
        });

        Schema::table('checklist_items', function (Blueprint $table) {
            $table->dropColumn(['watermelon_id', 'status']);
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->dropColumn('watermelon_id');
        });
    }
};
