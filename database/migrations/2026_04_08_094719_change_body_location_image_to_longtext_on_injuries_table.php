<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('injuries', function (Blueprint $table) {
            $table->longText('body_location_image')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('injuries', function (Blueprint $table) {
            $table->string('body_location_image')->nullable()->change();
        });
    }
};
