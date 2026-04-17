<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('premier_divisions', function (Blueprint $table) {
            $table->id();
            $table->uuid('premier_division_id')->unique();
            $table->string('code')->index();
            $table->string('description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('premier_divisions');
    }
};
