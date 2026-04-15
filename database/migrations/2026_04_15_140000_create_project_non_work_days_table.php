<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_non_work_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->date('start');
            $table->date('end');
            $table->string('type', 32); // safety, industrial_action, weather, other
            $table->string('title');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['location_id', 'start', 'end']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_non_work_days');
    }
};
