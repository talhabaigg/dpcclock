<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JobSummary extends Model
{
    protected $table = 'job_summaries';
    protected $fillable = [
        'job_number',
        'company_code',
        'start_date',
        'estimated_end_date',
        'actual_end_date',
        'status',
    ];

    protected $casts = [
        'start_date' => 'date',
        'estimated_end_date' => 'date',
        'actual_end_date' => 'date',
    ];
}
