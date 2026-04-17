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
        Schema::table('job_retention_settings', function (Blueprint $table) {
            $table->string('manual_customer_name')->nullable()->after('manual_retention_held');
            $table->decimal('manual_contract_value', 14, 2)->nullable()->after('manual_customer_name');
            $table->date('manual_estimated_end_date')->nullable()->after('manual_contract_value');
        });
    }

    public function down(): void
    {
        Schema::table('job_retention_settings', function (Blueprint $table) {
            $table->dropColumn(['manual_customer_name', 'manual_contract_value', 'manual_estimated_end_date']);
        });
    }
};
