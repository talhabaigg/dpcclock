<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ArProgressBillingSummary extends Model
{
    protected $table = 'ar_progress_billing_summaries';

    protected $fillable = [
        'job_number',
        'application_number',
        'description',
        'from_date',
        'period_end_date',
        'status_name',
        'this_app_work_completed',
    ];
}
