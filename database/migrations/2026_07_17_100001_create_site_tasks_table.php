<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('site_tasks')) {
            return;
        }

        Schema::create('site_tasks', function (Blueprint $table) {
            $table->id();
            $table->string('watermelon_id', 36)->nullable()->unique();
            $table->foreignId('location_id')->constrained('locations')->cascadeOnDelete();
            // Unit pin -> children (rectifications, work-tracker phases). One level only (app-enforced).
            $table->foreignId('parent_id')->nullable()->constrained('site_tasks')->nullOnDelete();
            $table->string('type', 20)->default('general'); // unit | rectification | work_tracker | general
            $table->string('title', 500);
            $table->text('description')->nullable();
            // Optional pin. Children without a pin display via their parent's pin.
            $table->foreignId('drawing_id')->nullable()->constrained('drawings')->nullOnDelete();
            $table->unsignedSmallInteger('page_number')->nullable();
            $table->decimal('x', 8, 6)->nullable();
            $table->decimal('y', 8, 6)->nullable();
            // Provenance: the QA checklist item this rectification was raised from.
            $table->foreignId('checklist_item_id')->nullable()->constrained('checklist_items')->nullOnDelete();
            $table->string('status', 20)->default('open'); // open | in_progress | completed | closed | cancelled
            $table->date('due_date')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['location_id', 'type']);
            $table->index(['location_id', 'status']);
            $table->index('parent_id');
            $table->index('drawing_id');
            $table->index('checklist_item_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_tasks');
    }
};
