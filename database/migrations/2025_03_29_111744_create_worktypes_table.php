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
        Schema::create('worktypes', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('eh_worktype_id');
            $table->string('eh_external_id')->nullable();
            $table->string('mapping_type')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('worktypes');
    }
};
