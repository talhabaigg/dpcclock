<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('injuries', function (Blueprint $table) {
            $table->longText('worker_signature')->nullable()->change();
            $table->longText('representative_signature')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('injuries', function (Blueprint $table) {
            $table->text('worker_signature')->nullable()->change();
            $table->text('representative_signature')->nullable()->change();
        });
    }
};
