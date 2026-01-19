<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VendorPaymentDelay extends Model
{
    protected $fillable = [
        'vendor',
        'source_month',
        'payment_month',
        'amount',
    ];

    protected $casts = [
        'source_month' => 'date',
        'payment_month' => 'date',
        'amount' => 'decimal:2',
    ];
}
