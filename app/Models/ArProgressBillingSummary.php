<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ArProgressBillingSummary extends Model
{
    protected $table = 'ar_progress_billing_summaries';

    protected $fillable = [
        'client_id',
        'company_code',
        'job_number',
        'progress_billing_report_number',
        'application_number',
        'description',
        'from_date',
        'period_end_date',
        'status_name',
        'this_app_work_completed',
        'materials_stored',
        'total_completed_and_stored_to_date',
        'percentage',
        'balance_to_finish',
        'this_app_retainage',
        'application_retainage_released',
        'original_contract_sum',
        'authorized_changes_to_date',
        'contract_sum_to_date',
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
    ];

    protected $casts = [
        'from_date' => 'date',
        'period_end_date' => 'date',
        'insert_date' => 'date',
        'update_date' => 'date',
        'active' => 'boolean',
        'this_app_work_completed' => 'decimal:2',
        'materials_stored' => 'decimal:2',
        'total_completed_and_stored_to_date' => 'decimal:2',
        'percentage' => 'decimal:6',
        'balance_to_finish' => 'decimal:2',
        'this_app_retainage' => 'decimal:4',
        'application_retainage_released' => 'decimal:4',
        'original_contract_sum' => 'decimal:2',
        'authorized_changes_to_date' => 'decimal:2',
        'contract_sum_to_date' => 'decimal:2',
        'retainage_to_date' => 'decimal:4',
        'total_earned_less_retainage' => 'decimal:2',
        'less_previous_applications' => 'decimal:2',
        'amount_payable_this_application' => 'decimal:2',
        'balance_to_finish_including_retainage' => 'decimal:2',
        'previous_materials_stored' => 'decimal:2',
    ];
}
