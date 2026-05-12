<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('application_phase_forms')) {
            return;
        }

        Schema::create('application_phase_forms', function (Blueprint $table) {
            $table->id();
            $table->string('model_type');
            $table->string('status');
            $table->foreignId('form_template_id')->constrained()->cascadeOnDelete();
            $table->string('assignee_strategy')->default('role'); // 'role' | 'user'
            $table->string('assignee_value'); // role name or user id
            $table->boolean('is_required')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['model_type', 'status', 'is_active'], 'app_phase_forms_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('application_phase_forms');
    }
};
