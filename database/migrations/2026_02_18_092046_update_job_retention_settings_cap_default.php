<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_retention_settings', function (Blueprint $table) {
            $table->decimal('retention_cap_pct', 5, 4)->default(0.0500)->change();
        });
    }

    public function down(): void
    {
        Schema::table('job_retention_settings', function (Blueprint $table) {
            $table->decimal('retention_cap_pct', 5, 4)->default(0.1000)->change();
        });
    }
};
