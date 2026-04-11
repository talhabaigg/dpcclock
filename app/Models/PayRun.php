<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayRun extends Model
{
    protected $fillable = [
        'eh_pay_run_id',
        'pay_period_starting',
        'pay_period_ending',
        'date_paid',
        'status',
        'leave_accruals_synced',
    ];

    protected $casts = [
        'pay_period_starting' => 'date',
        'pay_period_ending' => 'date',
        'date_paid' => 'date',
        'leave_accruals_synced' => 'boolean',
    ];

    public function leaveAccruals(): HasMany
    {
        return $this->hasMany(PayRunLeaveAccrual::class);
    }
}
