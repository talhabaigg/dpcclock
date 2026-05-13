<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clocks', function (Blueprint $table) {
            $table->unsignedBigInteger('eh_kiosk_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('clocks', function (Blueprint $table) {
            $table->unsignedBigInteger('eh_kiosk_id')->nullable(false)->change();
        });
    }
};
