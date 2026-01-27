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
        'overtime_hours',
        'leave_hours',
        'hourly_rate',
        'weekly_cost',
        'cost_breakdown_snapshot',
    ];

    protected $casts = [
        'week_ending' => 'date',
        'headcount' => 'decimal:2',
        'overtime_hours' => 'decimal:2',
        'leave_hours' => 'decimal:2',
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

    /**
     * Get ordinary hours (headcount × 40)
     */
    public function getOrdinaryHours(): float
    {
        return (float) $this->headcount * 40;
    }

    /**
     * Get worked hours (ordinary + overtime, excludes leave)
     */
    public function getWorkedHours(): float
    {
        return $this->getOrdinaryHours() + (float) ($this->overtime_hours ?? 0);
    }

    /**
     * Get total hours (ordinary + overtime + leave)
     */
    public function getTotalHours(): float
    {
        return $this->getWorkedHours() + (float) ($this->leave_hours ?? 0);
    }

    /**
     * Get overtime hours
     */
    public function getOvertimeHours(): float
    {
        return (float) ($this->overtime_hours ?? 0);
    }

    /**
     * Get leave hours (for oncosts calculation only - wages paid from accruals)
     */
    public function getLeaveHours(): float
    {
        return (float) ($this->leave_hours ?? 0);
    }
}
