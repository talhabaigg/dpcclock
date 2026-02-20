<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('agent_tasks')) {
            Schema::create('agent_tasks', function (Blueprint $table) {
                $table->id();
                $table->foreignId('requisition_id')->constrained()->onDelete('cascade');
                $table->string('type'); // send_to_supplier
                $table->string('status')->default('pending'); // pending, awaiting_confirmation, processing, completed, failed, cancelled
                $table->json('context')->nullable();
                $table->json('screenshots')->nullable();
                $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('confirmed_at')->nullable();
                $table->integer('retry_count')->default(0);
                $table->timestamp('started_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();

                $table->index(['requisition_id', 'status']);
                $table->index(['status', 'type']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_tasks');
    }
};
