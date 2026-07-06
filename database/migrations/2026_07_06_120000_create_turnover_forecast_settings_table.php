<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('turnover_forecast_settings', function (Blueprint $table) {
            $table->id();
            $table->decimal('monthly_overhead', 12, 2)->default(200000);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('turnover_forecast_settings');
    }
};
