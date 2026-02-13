<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConditionLabourCode extends Model
{
    protected $fillable = [
        'takeoff_condition_id',
        'labour_cost_code_id',
        'production_rate',
        'hourly_rate',
    ];

    protected $casts = [
        'production_rate' => 'float',
        'hourly_rate' => 'float',
    ];

    public function condition(): BelongsTo
    {
        return $this->belongsTo(TakeoffCondition::class, 'takeoff_condition_id');
    }

    public function labourCostCode(): BelongsTo
    {
        return $this->belongsTo(LabourCostCode::class);
    }

    /**
     * Get effective production rate (condition-level override or LCC default).
     */
    public function getEffectiveProductionRateAttribute(): ?float
    {
        return $this->production_rate ?? $this->labourCostCode?->default_production_rate;
    }

    /**
     * Get effective hourly rate (condition-level override or LCC default).
     */
    public function getEffectiveHourlyRateAttribute(): ?float
    {
        return $this->hourly_rate ?? $this->labourCostCode?->default_hourly_rate;
    }
}
