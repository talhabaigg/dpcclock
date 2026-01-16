<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompanyMonthlyRevenueTarget extends Model
{
    protected $table = 'company_monthly_revenue_targets';

    protected $fillable = [
        'fy_year',
        'month',
        'target_amount',
    ];

    protected $casts = [
        'target_amount' => 'decimal:2',
    ];
}
