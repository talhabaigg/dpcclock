<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gl_account_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index('sort_order');
        });

        Schema::create('gl_account_group_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gl_account_group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('premier_gl_account_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['gl_account_group_id', 'sort_order'], 'gl_assignments_group_sort_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gl_account_group_assignments');
        Schema::dropIfExists('gl_account_groups');
    }
};
