<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CashForecastSetting extends Model
{
    protected $fillable = [
        'starting_balance',
        'starting_balance_date',
    ];

    protected $casts = [
        'starting_balance' => 'decimal:2',
        'starting_balance_date' => 'date',
    ];

    /**
     * Get the current settings or create default.
     */
    public static function current(): self
    {
        return self::first() ?? self::create([
            'starting_balance' => 0,
            'starting_balance_date' => now()->startOfMonth(),
        ]);
    }
}
