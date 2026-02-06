<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('related_kiosks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_kiosk_id')->constrained('kiosks')->onDelete('cascade');
            $table->foreignId('child_kiosk_id')->constrained('kiosks')->onDelete('cascade');
            $table->unique(['parent_kiosk_id', 'child_kiosk_id']);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('related_kiosks');
    }
};
