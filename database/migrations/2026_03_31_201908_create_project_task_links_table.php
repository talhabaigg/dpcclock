<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('project_task_links')) {
            return;
        }

        Schema::create('project_task_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->foreignId('source_id')->constrained('project_tasks')->cascadeOnDelete();
            $table->foreignId('target_id')->constrained('project_tasks')->cascadeOnDelete();
            // FS = finish-to-start, SS = start-to-start, FF = finish-to-finish, SF = start-to-finish
            $table->enum('type', ['FS', 'SS', 'FF', 'SF'])->default('FS');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['source_id', 'target_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_task_links');
    }
};
