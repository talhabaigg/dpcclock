<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('production_upload_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('production_upload_id')->constrained()->cascadeOnDelete();
            $table->string('area');
            $table->string('code_description');
            $table->string('cost_code');
            $table->decimal('est_hours', 10, 2)->default(0);
            $table->decimal('percent_complete', 8, 4)->default(0);
            $table->decimal('earned_hours', 10, 2)->default(0);
            $table->decimal('used_hours', 10, 2)->default(0);
            $table->decimal('actual_variance', 10, 2)->default(0);
            $table->decimal('remaining_hours', 10, 2)->default(0);
            $table->decimal('projected_hours', 10, 2)->default(0);
            $table->decimal('projected_variance', 10, 2)->default(0);
            $table->timestamps();

            $table->index('production_upload_id');
            $table->index('cost_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('production_upload_lines');
    }
};
