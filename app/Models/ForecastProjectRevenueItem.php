<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ForecastProjectRevenueItem extends Model
{
    protected $fillable = [
        'forecast_project_id',
        'cost_item',
        'cost_item_description',
        'contract_sum_to_date',
        'display_order',
    ];

    protected $casts = [
        'contract_sum_to_date' => 'decimal:2',
    ];

    /**
     * Get the forecast project this revenue item belongs to
     */
    public function forecastProject(): BelongsTo
    {
        return $this->belongsTo(ForecastProject::class);
    }
}
