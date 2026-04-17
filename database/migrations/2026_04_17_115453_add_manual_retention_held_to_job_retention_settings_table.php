<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('job_retention_settings', function (Blueprint $table) {
            $table->decimal('manual_retention_held', 10, 2)->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('job_retention_settings', function (Blueprint $table) {
            $table->dropColumn('manual_retention_held');
        });
    }
};
