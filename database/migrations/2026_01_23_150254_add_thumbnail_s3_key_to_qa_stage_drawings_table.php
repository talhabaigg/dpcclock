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
        Schema::table('qa_stage_drawings', function (Blueprint $table) {
            $table->string('thumbnail_s3_key')->nullable()->after('page_preview_s3_key');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('qa_stage_drawings', function (Blueprint $table) {
            $table->dropColumn('thumbnail_s3_key');
        });
    }
};
