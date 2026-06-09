<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_retention_settings', function (Blueprint $table) {
            $table->date('manual_first_release_date')->nullable()->after('manual_estimated_end_date');
            $table->date('manual_second_release_date')->nullable()->after('manual_first_release_date');
        });
    }

    public function down(): void
    {
        Schema::table('job_retention_settings', function (Blueprint $table) {
            $table->dropColumn(['manual_first_release_date', 'manual_second_release_date']);
        });
    }
};
