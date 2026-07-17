<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Categories replace the old structural `type` enum outright — one
     * user-facing classification per task, managed as data. Structural
     * behaviour derives from parent_id / checklist_item_id instead.
     */
    public function up(): void
    {
        if (Schema::hasTable('site_task_categories')) {
            return;
        }

        Schema::create('site_task_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('code', 4); // pin-head initials, e.g. "PV"
            $table->string('color', 9); // hex
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        $now = now();
        DB::table('site_task_categories')->insert([
            ['name' => 'Builder Concerns', 'code' => 'BC', 'color' => '#64748b', 'sort_order' => 1, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Potential Variation', 'code' => 'PV', 'color' => '#2563eb', 'sort_order' => 2, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'QA frame Fr WALL', 'code' => 'QF', 'color' => '#dc2626', 'sort_order' => 3, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'QA Pre-sheet', 'code' => 'PR', 'color' => '#a855f7', 'sort_order' => 4, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'QA Sheeting FR walls', 'code' => 'QS', 'color' => '#0d9488', 'sort_order' => 5, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Works Tracker', 'code' => 'WT', 'color' => '#f97316', 'sort_order' => 6, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            // Rectifications raised from checklist problems land here.
            ['name' => 'Rectification', 'code' => 'RE', 'color' => '#f59e0b', 'sort_order' => 7, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);

        Schema::table('site_tasks', function (Blueprint $table) {
            $table->foreignId('category_id')->nullable()->after('type')
                ->constrained('site_task_categories')->nullOnDelete();
        });

        // Map old structural types onto categories, then drop the enum.
        $categories = DB::table('site_task_categories')->pluck('id', 'code');
        DB::table('site_tasks')->where('type', 'work_tracker')->update(['category_id' => $categories['WT']]);
        DB::table('site_tasks')->where('type', 'rectification')->update(['category_id' => $categories['RE']]);

        Schema::table('site_tasks', function (Blueprint $table) {
            $table->dropColumn('type');
        });
    }

    public function down(): void
    {
        Schema::table('site_tasks', function (Blueprint $table) {
            $table->string('type', 20)->default('general')->after('parent_id');
        });

        $categories = DB::table('site_task_categories')->pluck('id', 'code');
        if (isset($categories['WT'])) {
            DB::table('site_tasks')->where('category_id', $categories['WT'])->update(['type' => 'work_tracker']);
        }
        if (isset($categories['RE'])) {
            DB::table('site_tasks')->where('category_id', $categories['RE'])->update(['type' => 'rectification']);
        }
        DB::table('site_tasks')->whereNull('parent_id')->update(['type' => 'unit']);

        Schema::table('site_tasks', function (Blueprint $table) {
            $table->dropConstrainedForeignId('category_id');
        });
        Schema::dropIfExists('site_task_categories');
    }
};
