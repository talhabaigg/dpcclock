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
        Schema::create('variations', function (Blueprint $table) {
            $table->id();
            $table->string('co_number');
            $table->string('type'); // internal purpose
            $table->string('description')->nullable();
            $table->string('status')->default('pending'); // internal purpose
            $table->date('co_date');
            $table->string('created_by')->nullable(); // Track who created the variation
            $table->string('updated_by')->nullable(); // Track who updated the variation
            $table->string('deleted_by')->nullable(); // Track who deleted the variation
            $table->softDeletes(); // Soft delete support
            $table->foreignId('location_id')->constrained('locations')->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('variations');
    }
};
