<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TurnoverForecastSetting extends Model
{
    protected $fillable = [
        'monthly_overhead',
    ];

    protected $casts = [
        'monthly_overhead' => 'decimal:2',
    ];

    public static function current(): self
    {
        return self::first() ?? self::create([
            'monthly_overhead' => 200000,
        ]);
    }
}
