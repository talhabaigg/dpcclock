<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('drawing_change_items') && ! Schema::hasColumn('drawing_change_items', 'triage_status')) {
            Schema::table('drawing_change_items', function (Blueprint $table) {
                // accepted | dismissed. Null means nobody has ruled on it yet,
                // which is what puts a change into the review queue.
                $table->string('triage_status', 20)->nullable()->after('preview_path');
                // The task raised from this change, so a second reviewer can see
                // it was already actioned rather than raising a duplicate.
                $table->foreignId('site_task_id')->nullable()->after('triage_status')
                    ->constrained('site_tasks')->nullOnDelete();
                $table->timestamp('triaged_at')->nullable()->after('site_task_id');
                $table->foreignId('triaged_by')->nullable()->after('triaged_at')
                    ->constrained('users')->nullOnDelete();

                $table->index(['drawing_comparison_id', 'triage_status'], 'drawing_change_items_triage_idx');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('drawing_change_items') && Schema::hasColumn('drawing_change_items', 'triage_status')) {
            Schema::table('drawing_change_items', function (Blueprint $table) {
                $table->dropForeign(['site_task_id']);
                $table->dropForeign(['triaged_by']);
                $table->dropIndex('drawing_change_items_triage_idx');
                $table->dropColumn(['triage_status', 'site_task_id', 'triaged_at', 'triaged_by']);
            });
        }
    }
};
