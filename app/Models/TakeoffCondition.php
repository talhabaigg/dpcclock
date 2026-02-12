<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TakeoffCondition extends Model
{
    protected $fillable = [
        'location_id',
        'name',
        'type',
        'color',
        'description',
        'pricing_method',
        'wall_height',
        'labour_unit_rate',
        'labour_rate_source',
        'manual_labour_rate',
        'pay_rate_template_id',
        'production_rate',
        'created_by',
    ];

    protected $casts = [
        'manual_labour_rate' => 'float',
        'production_rate' => 'float',
        'wall_height' => 'float',
        'labour_unit_rate' => 'float',
    ];

    protected static function booted()
    {
        static::creating(function ($model) {
            if ($model->created_by === null) {
                $model->created_by = auth()->id();
            }
        });
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function materials(): HasMany
    {
        return $this->hasMany(TakeoffConditionMaterial::class);
    }

    public function costCodes(): HasMany
    {
        return $this->hasMany(TakeoffConditionCostCode::class);
    }

    public function payRateTemplate(): BelongsTo
    {
        return $this->belongsTo(LocationPayRateTemplate::class, 'pay_rate_template_id');
    }

    public function measurements(): HasMany
    {
        return $this->hasMany(DrawingMeasurement::class, 'takeoff_condition_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the multiplier for converting measured quantity to pricing quantity.
     * For unit_rate + linear type with wall_height, converts lm to m2.
     */
    public function getUnitRateMultiplierAttribute(): float
    {
        if ($this->pricing_method !== 'unit_rate') {
            return 1.0;
        }

        if ($this->type === 'linear' && $this->wall_height && $this->wall_height > 0) {
            return $this->wall_height;
        }

        return 1.0;
    }

    /**
     * Get the effective labour rate (manual or computed from template).
     */
    public function getEffectiveLabourRateAttribute(): ?float
    {
        if ($this->labour_rate_source === 'manual') {
            return $this->manual_labour_rate;
        }

        if ($this->payRateTemplate) {
            return (float) $this->payRateTemplate->hourly_rate;
        }

        return null;
    }
}
