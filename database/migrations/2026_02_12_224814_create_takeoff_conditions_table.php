<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('takeoff_conditions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->string('name', 255);
            $table->enum('type', ['linear', 'area', 'count']);
            $table->string('color', 7)->default('#3b82f6');
            $table->text('description')->nullable();
            $table->enum('labour_rate_source', ['manual', 'template'])->default('manual');
            $table->decimal('manual_labour_rate', 10, 2)->nullable();
            $table->foreignId('pay_rate_template_id')->nullable()->constrained('location_pay_rate_templates')->nullOnDelete();
            $table->decimal('production_rate', 10, 4)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['location_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('takeoff_conditions');
    }
};
