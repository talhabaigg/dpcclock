<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swms_version_signatures', function (Blueprint $table) {
            $table->id();
            $table->uuid('swms_version_id');
            $table->unsignedBigInteger('employee_id');
            $table->timestamp('signed_at');
            $table->timestamp('original_signed_at')->nullable();
            $table->uuid('carried_from_version_id')->nullable();
            $table->timestamps();

            $table->foreign('swms_version_id')->references('id')->on('swms_versions')->cascadeOnDelete();
            $table->foreign('employee_id')->references('id')->on('employees')->cascadeOnDelete();
            $table->foreign('carried_from_version_id')->references('id')->on('swms_versions')->nullOnDelete();

            $table->unique(['swms_version_id', 'employee_id']);
            $table->index('signed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swms_version_signatures');
    }
};
