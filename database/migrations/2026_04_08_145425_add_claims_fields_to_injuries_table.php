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
        Schema::table('injuries', function (Blueprint $table) {
            $table->boolean('claim_active')->default(false)->after('work_cover_claim');
            $table->string('claim_type', 50)->nullable()->after('claim_active');
            $table->string('claim_status', 50)->nullable()->after('claim_type');
            $table->string('capacity', 50)->nullable()->after('claim_status');
            $table->string('employment_status', 50)->nullable()->after('capacity');
            $table->decimal('claim_cost', 12, 2)->default(0)->after('employment_status');
            $table->smallInteger('days_suitable_duties')->default(0)->after('work_days_missed');
            $table->decimal('medical_expenses', 10, 2)->default(0)->after('days_suitable_duties');
        });
    }

    public function down(): void
    {
        Schema::table('injuries', function (Blueprint $table) {
            $table->dropColumn([
                'claim_active', 'claim_type', 'claim_status',
                'capacity', 'employment_status', 'claim_cost',
                'days_suitable_duties', 'medical_expenses',
            ]);
        });
    }
};
