<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drawing_observations', function (Blueprint $table) {
            $table->renameColumn('qa_stage_drawing_id', 'drawing_id');
        });
    }

    public function down(): void
    {
        Schema::table('drawing_observations', function (Blueprint $table) {
            $table->renameColumn('drawing_id', 'qa_stage_drawing_id');
        });
    }
};
