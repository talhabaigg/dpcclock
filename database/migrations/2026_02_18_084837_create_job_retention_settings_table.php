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
        Schema::create('job_retention_settings', function (Blueprint $table) {
            $table->id();
            $table->string('job_number')->unique();
            $table->decimal('retention_rate', 5, 4)->default(0.0500); // e.g. 0.0500 = 5%
            $table->decimal('retention_cap_pct', 5, 4)->default(0.0500); // e.g. 0.0500 = 5% of contract
            $table->boolean('is_auto')->default(true);
            $table->date('release_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('job_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('job_retention_settings');
    }
};
