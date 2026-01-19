<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CashOutAdjustment extends Model
{
    protected $fillable = [
        'job_number',
        'cost_item',
        'vendor',
        'source_month',
        'payment_month',
        'amount',
    ];
}
