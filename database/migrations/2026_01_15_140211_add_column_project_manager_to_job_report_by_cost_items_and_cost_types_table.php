<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('job_report_by_cost_items_and_cost_types', function (Blueprint $table) {
            $table->string('project_manager')->nullable()->after('estimate_to_completion');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('job_report_by_cost_items_and_cost_types', function (Blueprint $table) {
            $table->dropColumn('project_manager');
        });
    }
};
