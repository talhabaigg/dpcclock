<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('location_safety_data_sheet', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->foreignId('safety_data_sheet_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['location_id', 'safety_data_sheet_id'], 'loc_sds_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('location_safety_data_sheet');
    }
};
