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
        Schema::create('worker_screenings', function (Blueprint $table) {
            $table->id();
            $table->string('first_name');
            $table->string('surname');
            $table->string('phone', 50)->nullable();
            $table->string('email')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->text('reason');
            $table->string('status')->default('active');
            $table->foreignId('added_by')->constrained('users');
            $table->foreignId('removed_by')->nullable()->constrained('users');
            $table->timestamp('removed_at')->nullable();
            $table->timestamps();

            $table->index('phone');
            $table->index('email');
            $table->index(['surname', 'first_name', 'date_of_birth']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('worker_screenings');
    }
};
