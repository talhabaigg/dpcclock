<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('condition_types')) {
            Schema::create('condition_types', function (Blueprint $table) {
                $table->id();
                $table->foreignId('location_id')->constrained()->cascadeOnDelete();
                $table->string('name', 100);
                $table->timestamps();

                $table->unique(['location_id', 'name']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('condition_types');
    }
};
