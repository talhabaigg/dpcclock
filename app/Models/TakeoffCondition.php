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
        'labour_rate_source',
        'manual_labour_rate',
        'pay_rate_template_id',
        'production_rate',
        'created_by',
    ];

    protected $casts = [
        'manual_labour_rate' => 'float',
        'production_rate' => 'float',
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
