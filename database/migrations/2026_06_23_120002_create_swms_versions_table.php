<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swms_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('swms_id');
            $table->string('version_number');
            $table->string('status')->default('draft');
            $table->uuid('supersedes_id')->nullable();
            $table->boolean('requires_resignature')->default(true);
            $table->text('change_summary')->nullable();
            $table->timestamp('effective_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('swms_id')->references('id')->on('swms')->cascadeOnDelete();
            $table->foreign('supersedes_id')->references('id')->on('swms_versions')->nullOnDelete();

            $table->unique(['swms_id', 'version_number']);
            $table->index(['swms_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swms_versions');
    }
};
