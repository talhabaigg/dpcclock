<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TakeoffCondition extends Model
{
    protected $fillable = [
        'location_id',
        'condition_type_id',
        'name',
        'condition_number',
        'type',
        'color',
        'pattern',
        'description',
        'pricing_method',
        'height',
        'thickness',
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
        'height' => 'float',
        'thickness' => 'float',
        'labour_unit_rate' => 'float',
        'condition_number' => 'integer',
    ];

    protected static function booted()
    {
        static::creating(function ($model) {
            if ($model->created_by === null) {
                $model->created_by = auth()->id();
            }

            // Auto-assign condition_number per location
            if ($model->condition_number === null && $model->location_id) {
                $maxNumber = static::where('location_id', $model->location_id)->max('condition_number') ?? 0;
                $model->condition_number = $maxNumber + 1;
            }
        });
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function conditionType(): BelongsTo
    {
        return $this->belongsTo(ConditionType::class);
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
     * For unit_rate + linear type with height, converts lm to m2.
     */
    public function getUnitRateMultiplierAttribute(): float
    {
        if ($this->pricing_method !== 'unit_rate') {
            return 1.0;
        }

        if ($this->type === 'linear' && $this->height && $this->height > 0) {
            return $this->height;
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
