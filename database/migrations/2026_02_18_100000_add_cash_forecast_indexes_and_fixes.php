<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // #1 — job_cost_details: critical, used by getActualData() with no indexes
        Schema::table('job_cost_details', function (Blueprint $table) {
            $table->index('job_number', 'jcd_job_number_idx');
            $table->index('transaction_date', 'jcd_transaction_date_idx');
            $table->index(['job_number', 'cost_item', 'transaction_date'], 'jcd_job_cost_txn_idx');
        });

        // #2 — ar_progress_billing_summaries: used by getRetentionData(), no indexes
        Schema::table('ar_progress_billing_summaries', function (Blueprint $table) {
            $table->index('job_number', 'arpbs_job_number_idx');
            $table->index(['job_number', 'application_number'], 'arpbs_job_app_idx');
        });

        // #3 — cash_forecast_general_costs: queried with is_active filter
        Schema::table('cash_forecast_general_costs', function (Blueprint $table) {
            $table->index(['is_active', 'start_date'], 'cfgc_active_start_idx');
        });

        // #4 — cash_in_adjustments: add index on receipt_month for date range queries
        Schema::table('cash_in_adjustments', function (Blueprint $table) {
            $table->index('receipt_month', 'cia_receipt_month_idx');
        });

        // #5 — cash_out_adjustments: add index on payment_month for date range queries
        Schema::table('cash_out_adjustments', function (Blueprint $table) {
            $table->index('payment_month', 'coa_payment_month_idx');
        });

        // #6 — job_retention_settings: add index on release_date for date range queries
        Schema::table('job_retention_settings', function (Blueprint $table) {
            $table->index('release_date', 'jrs_release_date_idx');
        });
    }

    public function down(): void
    {
        Schema::table('job_cost_details', function (Blueprint $table) {
            $table->dropIndex('jcd_job_number_idx');
            $table->dropIndex('jcd_transaction_date_idx');
            $table->dropIndex('jcd_job_cost_txn_idx');
        });

        Schema::table('ar_progress_billing_summaries', function (Blueprint $table) {
            $table->dropIndex('arpbs_job_number_idx');
            $table->dropIndex('arpbs_job_app_idx');
        });

        Schema::table('cash_forecast_general_costs', function (Blueprint $table) {
            $table->dropIndex('cfgc_active_start_idx');
        });

        Schema::table('cash_in_adjustments', function (Blueprint $table) {
            $table->dropIndex('cia_receipt_month_idx');
        });

        Schema::table('cash_out_adjustments', function (Blueprint $table) {
            $table->dropIndex('coa_payment_month_idx');
        });

        Schema::table('job_retention_settings', function (Blueprint $table) {
            $table->dropIndex('jrs_release_date_idx');
        });
    }
};
