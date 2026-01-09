<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JobForecastData extends Model
{
    protected $table = 'job_forecast_data';

    protected $fillable = [
        'location_id',
        'job_number',
        'grid_type',
        'cost_item',
        'month',
        'forecast_amount',
    ];

    protected $casts = [
        'forecast_amount' => 'decimal:2',
    ];
}
