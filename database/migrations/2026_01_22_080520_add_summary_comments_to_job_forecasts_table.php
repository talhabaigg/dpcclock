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
        Schema::table('job_forecasts', function (Blueprint $table) {
            $table->text('summary_comments')->nullable()->after('rejection_note');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('job_forecasts', function (Blueprint $table) {
            $table->dropColumn('summary_comments');
        });
    }
};
