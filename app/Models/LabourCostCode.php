<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LabourCostCode extends Model
{
    protected $fillable = [
        'location_id',
        'code',
        'name',
        'unit',
        'default_production_rate',
        'default_hourly_rate',
    ];

    protected $casts = [
        'default_production_rate' => 'float',
        'default_hourly_rate' => 'float',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function conditions(): BelongsToMany
    {
        return $this->belongsToMany(TakeoffCondition::class, 'condition_labour_codes')
            ->withPivot('production_rate', 'hourly_rate')
            ->withTimestamps();
    }

    public function conditionLabourCodes(): HasMany
    {
        return $this->hasMany(ConditionLabourCode::class);
    }

    public function measurementStatuses(): HasMany
    {
        return $this->hasMany(MeasurementStatus::class);
    }

    /**
     * Scope to order by code.
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('code');
    }
}
