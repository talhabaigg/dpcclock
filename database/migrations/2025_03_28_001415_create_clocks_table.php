<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('clocks', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('eh_kiosk_id')->index();
            $table->unsignedBigInteger('eh_employee_id')->index();
            $table->timestamp('clock_in')->nullable();
            $table->timestamp('clock_out')->nullable();
            $table->string('eh_location_id')->nullable(); // Optional
            
            $table->decimal('hours_worked', 8, 2)->nullable(); // Optional
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('clocks');
    }
};
