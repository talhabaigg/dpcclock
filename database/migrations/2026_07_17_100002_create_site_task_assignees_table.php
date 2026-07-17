<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_task_assignees', function (Blueprint $table) {
            $table->id();
            $table->string('watermelon_id', 36)->nullable()->unique();
            $table->foreignId('site_task_id')->constrained('site_tasks')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            // Per-person completion: "who actually did this phase, and when".
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('marked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            // Unassign soft-deletes the row; re-assign restores it (see SiteTask::assignEmployee).
            $table->unique(['site_task_id', 'employee_id']);
            $table->index('employee_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_task_assignees');
    }
};
