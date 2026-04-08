<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('toolbox_talks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->date('meeting_date');
            $table->foreignId('called_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('meeting_subject');
            $table->json('key_topics')->nullable();
            $table->json('action_points')->nullable();
            $table->json('near_misses')->nullable();
            $table->json('floor_comments')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('locked_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('meeting_date');
            $table->index('location_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('toolbox_talks');
    }
};
