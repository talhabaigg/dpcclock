<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LabourForecastEntry extends Model
{
    protected $fillable = [
        'labour_forecast_id',
        'location_pay_rate_template_id',
        'week_ending',
        'headcount',
        'hourly_rate',
        'weekly_cost',
        'cost_breakdown_snapshot',
    ];

    protected $casts = [
        'week_ending' => 'date',
        'headcount' => 'integer',
        'hourly_rate' => 'decimal:2',
        'weekly_cost' => 'decimal:2',
        'cost_breakdown_snapshot' => 'array',
    ];

    /**
     * Get the parent forecast
     */
    public function forecast(): BelongsTo
    {
        return $this->belongsTo(LabourForecast::class, 'labour_forecast_id');
    }

    /**
     * Get the pay rate template configuration
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(LocationPayRateTemplate::class, 'location_pay_rate_template_id');
    }

    /**
     * Calculate the total cost for this entry (headcount × weekly_cost)
     */
    public function getTotalCost(): float
    {
        return $this->headcount * ($this->weekly_cost ?? 0);
    }

    /**
     * Get the cost breakdown (from snapshot or calculate fresh if not available)
     */
    public function getCostBreakdown(): ?array
    {
        return $this->cost_breakdown_snapshot;
    }
}
