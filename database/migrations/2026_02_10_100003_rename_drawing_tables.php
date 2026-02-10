<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('qa_stage_drawings', 'drawings');
        Schema::rename('qa_stage_drawing_observations', 'drawing_observations');
    }

    public function down(): void
    {
        Schema::rename('drawings', 'qa_stage_drawings');
        Schema::rename('drawing_observations', 'qa_stage_drawing_observations');
    }
};
