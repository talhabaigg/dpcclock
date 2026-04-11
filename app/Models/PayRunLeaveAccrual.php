<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayRunLeaveAccrual extends Model
{
    protected $fillable = [
        'pay_run_id',
        'eh_employee_id',
        'leave_category_id',
        'leave_category_name',
        'accrual_type',
        'amount',
        'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:4',
    ];

    public function payRun(): BelongsTo
    {
        return $this->belongsTo(PayRun::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'eh_employee_id', 'eh_employee_id');
    }
}
