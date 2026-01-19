<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CashInAdjustment extends Model
{
    protected $fillable = [
        'job_number',
        'source_month',
        'receipt_month',
        'amount',
    ];
}
