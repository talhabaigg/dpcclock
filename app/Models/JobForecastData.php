<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JobForecastData extends Model
{
    protected $table = 'job_forecast_data';

    protected $fillable = [
        'location_id',
        'forecast_project_id',
        'job_number',
        'grid_type',
        'cost_item',
        'month',
        'forecast_amount',
    ];

    protected $casts = [
        'forecast_amount' => 'decimal:2',
    ];

    /**
     * Get the forecast project this data belongs to (if any)
     */
    public function forecastProject(): BelongsTo
    {
        return $this->belongsTo(ForecastProject::class);
    }

    /**
     * Get the location this data belongs to (if any)
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }
}
