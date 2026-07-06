<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_retention_settings', function (Blueprint $table) {
            $table->decimal('manual_first_release_amount', 15, 2)->nullable()->after('manual_second_release_date');
            $table->decimal('manual_second_release_amount', 15, 2)->nullable()->after('manual_first_release_amount');
        });
    }

    public function down(): void
    {
        Schema::table('job_retention_settings', function (Blueprint $table) {
            $table->dropColumn(['manual_first_release_amount', 'manual_second_release_amount']);
        });
    }
};
