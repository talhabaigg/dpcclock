<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('qa_stage_drawing_observations', function (Blueprint $table) {
            // Source of the observation - null for manual, 'ai_comparison' for AI-generated
            $table->string('source')->nullable()->after('description');
            // Store reference to which sheets were compared to generate this observation
            $table->unsignedBigInteger('source_sheet_a_id')->nullable()->after('source');
            $table->unsignedBigInteger('source_sheet_b_id')->nullable()->after('source_sheet_a_id');
            // Store the AI-detected change type and impact
            $table->string('ai_change_type')->nullable()->after('source_sheet_b_id');
            $table->string('ai_impact')->nullable()->after('ai_change_type');
            $table->string('ai_location')->nullable()->after('ai_impact');
            $table->boolean('potential_change_order')->default(false)->after('ai_location');
            // Whether this observation has been reviewed/confirmed by a human
            $table->boolean('is_confirmed')->default(false)->after('potential_change_order');
            $table->timestamp('confirmed_at')->nullable()->after('is_confirmed');
            $table->unsignedBigInteger('confirmed_by')->nullable()->after('confirmed_at');
        });
    }

    public function down(): void
    {
        Schema::table('qa_stage_drawing_observations', function (Blueprint $table) {
            $table->dropColumn([
                'source',
                'source_sheet_a_id',
                'source_sheet_b_id',
                'ai_change_type',
                'ai_impact',
                'ai_location',
                'potential_change_order',
                'is_confirmed',
                'confirmed_at',
                'confirmed_by',
            ]);
        });
    }
};
