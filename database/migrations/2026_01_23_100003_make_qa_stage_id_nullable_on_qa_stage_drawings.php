<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     *
     * Makes qa_stage_id nullable so drawing sheets can be created
     * from drawing_sets without being linked to a QA stage.
     */
    public function up(): void
    {
        Schema::table('qa_stage_drawings', function (Blueprint $table) {
            // Drop the foreign key constraint first
            $table->dropForeign(['qa_stage_id']);
        });

        Schema::table('qa_stage_drawings', function (Blueprint $table) {
            // Make the column nullable
            $table->unsignedBigInteger('qa_stage_id')->nullable()->change();

            // Re-add the foreign key constraint
            $table->foreign('qa_stage_id')
                ->references('id')
                ->on('qa_stages')
                ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Note: This will fail if there are null qa_stage_id values
        Schema::table('qa_stage_drawings', function (Blueprint $table) {
            $table->dropForeign(['qa_stage_id']);
        });

        Schema::table('qa_stage_drawings', function (Blueprint $table) {
            $table->unsignedBigInteger('qa_stage_id')->nullable(false)->change();

            $table->foreign('qa_stage_id')
                ->references('id')
                ->on('qa_stages')
                ->onDelete('cascade');
        });
    }
};
