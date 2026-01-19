<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CashForecastSetting extends Model
{
    protected $fillable = [
        'starting_balance',
        'starting_balance_date',
        'gst_q1_pay_month',
        'gst_q2_pay_month',
        'gst_q3_pay_month',
        'gst_q4_pay_month',
    ];

    protected $casts = [
        'starting_balance' => 'decimal:2',
        'starting_balance_date' => 'date',
        'gst_q1_pay_month' => 'integer',
        'gst_q2_pay_month' => 'integer',
        'gst_q3_pay_month' => 'integer',
        'gst_q4_pay_month' => 'integer',
    ];

    /**
     * Get the current settings or create default.
     */
    public static function current(): self
    {
        return self::first() ?? self::create([
            'starting_balance' => 0,
            'starting_balance_date' => now()->startOfMonth(),
            'gst_q1_pay_month' => 4,
            'gst_q2_pay_month' => 8,
            'gst_q3_pay_month' => 11,
            'gst_q4_pay_month' => 2,
        ]);
    }
}
