<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ForecastProjectCostItem extends Model
{
    protected $fillable = [
        'forecast_project_id',
        'cost_item',
        'cost_item_description',
        'budget',
        'display_order',
    ];

    protected $casts = [
        'budget' => 'decimal:2',
    ];

    /**
     * Get the forecast project this cost item belongs to
     */
    public function forecastProject(): BelongsTo
    {
        return $this->belongsTo(ForecastProject::class);
    }
}
