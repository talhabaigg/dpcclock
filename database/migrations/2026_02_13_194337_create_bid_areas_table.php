<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bid_areas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('bid_areas')->cascadeOnDelete();
            $table->string('name', 255);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index(['location_id', 'parent_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bid_areas');
    }
};
