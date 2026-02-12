<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('drawing_measurements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('drawing_id')->constrained('drawings')->cascadeOnDelete();
            $table->string('name', 255);
            $table->enum('type', ['linear', 'area']);
            $table->string('color', 7)->default('#3b82f6');
            $table->string('category', 100)->nullable();
            $table->json('points');
            $table->decimal('computed_value', 16, 4)->nullable();
            $table->string('unit', 20)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['drawing_id', 'type']);
            $table->index(['drawing_id', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drawing_measurements');
    }
};
