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
        Schema::table('ar_progress_billing_summaries', function (Blueprint $table) {
            $table->integer('client_id')->nullable()->after('id');
            $table->string('company_code')->nullable()->after('client_id');
            $table->integer('progress_billing_report_number')->nullable()->after('application_number');
            $table->decimal('materials_stored', 18, 2)->nullable()->after('this_app_work_completed');
            $table->decimal('total_completed_and_stored_to_date', 18, 2)->nullable()->after('materials_stored');
            $table->decimal('percentage', 18, 6)->nullable()->after('total_completed_and_stored_to_date');
            $table->decimal('balance_to_finish', 18, 2)->nullable()->after('percentage');
            $table->decimal('this_app_retainage', 18, 4)->nullable()->after('balance_to_finish');
            $table->decimal('application_retainage_released', 18, 4)->nullable()->after('this_app_retainage');
            $table->decimal('original_contract_sum', 18, 2)->nullable()->after('application_retainage_released');
            $table->decimal('authorized_changes_to_date', 18, 2)->nullable()->after('original_contract_sum');
            $table->decimal('retainage_to_date', 18, 4)->nullable()->after('contract_sum_to_date');
            $table->decimal('total_earned_less_retainage', 18, 2)->nullable()->after('retainage_to_date');
            $table->decimal('less_previous_applications', 18, 2)->nullable()->after('total_earned_less_retainage');
            $table->decimal('amount_payable_this_application', 18, 2)->nullable()->after('less_previous_applications');
            $table->decimal('balance_to_finish_including_retainage', 18, 2)->nullable()->after('amount_payable_this_application');
            $table->decimal('previous_materials_stored', 18, 2)->nullable()->after('balance_to_finish_including_retainage');
            $table->string('invoice_number')->nullable()->after('previous_materials_stored');
            $table->boolean('active')->nullable()->after('invoice_number');
            $table->string('insert_user')->nullable()->after('active');
            $table->date('insert_date')->nullable()->after('insert_user');
            $table->string('update_user')->nullable()->after('insert_date');
            $table->date('update_date')->nullable()->after('update_user');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ar_progress_billing_summaries', function (Blueprint $table) {
            $table->dropColumn([
                'client_id',
                'company_code',
                'progress_billing_report_number',
                'materials_stored',
                'total_completed_and_stored_to_date',
                'percentage',
                'balance_to_finish',
                'this_app_retainage',
                'application_retainage_released',
                'original_contract_sum',
                'authorized_changes_to_date',
                'retainage_to_date',
                'total_earned_less_retainage',
                'less_previous_applications',
                'amount_payable_this_application',
                'balance_to_finish_including_retainage',
                'previous_materials_stored',
                'invoice_number',
                'active',
                'insert_user',
                'insert_date',
                'update_user',
                'update_date',
            ]);
        });
    }
};
