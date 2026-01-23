<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     *
     * Make qa_stage_id nullable to support project-level drawing sheets
     * that aren't tied to a specific QA stage.
     */
    public function up(): void
    {
        // Drop the foreign key constraint first
        Schema::table('drawing_sheets', function (Blueprint $table) {
            $table->dropForeign(['qa_stage_id']);
        });

        // Make the column nullable
        Schema::table('drawing_sheets', function (Blueprint $table) {
            $table->unsignedBigInteger('qa_stage_id')->nullable()->change();
        });

        // Re-add the foreign key (now allowing nulls)
        Schema::table('drawing_sheets', function (Blueprint $table) {
            $table->foreign('qa_stage_id')
                ->references('id')
                ->on('qa_stages')
                ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // This is a one-way migration - we can't easily make it NOT NULL again
        // without potentially losing data
    }
};
