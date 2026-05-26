<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daily_prestart_signatures', function (Blueprint $table) {
            $table->mediumText('signature')->change();
        });
    }

    public function down(): void
    {
        Schema::table('daily_prestart_signatures', function (Blueprint $table) {
            $table->text('signature')->change();
        });
    }
};
