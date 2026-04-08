<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_prestarts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->date('work_date');
            $table->foreignId('foreman_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('weather')->nullable();
            $table->text('weather_impact')->nullable();
            $table->json('activities')->nullable();
            $table->json('safety_concerns')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['location_id', 'work_date']);
            $table->index('work_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_prestarts');
    }
};
