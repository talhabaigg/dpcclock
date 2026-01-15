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
        Schema::table('job_summaries', function (Blueprint $table) {
            $table->decimal('original_estimate_cost', 15, 2)->nullable()->after('status');
            $table->decimal('current_estimate_cost', 15, 2)->nullable()->after('original_estimate_cost');
            $table->decimal('original_estimate_revenue', 15, 2)->nullable()->after('current_estimate_cost');
            $table->decimal('current_estimate_revenue', 15, 2)->nullable()->after('original_estimate_revenue');
            $table->decimal('over_under_billing', 15, 2)->nullable()->after('current_estimate_revenue');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('job_summaries', function (Blueprint $table) {
            $table->dropColumn([
                'original_estimate_cost',
                'current_estimate_cost',
                'original_estimate_revenue',
                'current_estimate_revenue',
                'over_under_billing',
            ]);
        });
    }
};
