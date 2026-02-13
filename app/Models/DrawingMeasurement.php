<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class DrawingMeasurement extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'drawing_id',
        'name',
        'type',
        'color',
        'category',
        'points',
        'computed_value',
        'unit',
        'scope',
        'variation_id',
        'source_measurement_id',
        'takeoff_condition_id',
        'material_cost',
        'labour_cost',
        'total_cost',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'points' => 'array',
        'computed_value' => 'float',
        'material_cost' => 'float',
        'labour_cost' => 'float',
        'total_cost' => 'float',
    ];

    protected static function booted()
    {
        static::creating(function ($model) {
            if ($model->created_by === null) {
                $model->created_by = auth()->id();
            }
        });

        static::updating(function ($model) {
            $model->updated_by = auth()->id();
        });
    }

    public function drawing(): BelongsTo
    {
        return $this->belongsTo(Drawing::class, 'drawing_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function condition(): BelongsTo
    {
        return $this->belongsTo(TakeoffCondition::class, 'takeoff_condition_id');
    }

    public function variation(): BelongsTo
    {
        return $this->belongsTo(Variation::class);
    }

    public function sourceMeasurement(): BelongsTo
    {
        return $this->belongsTo(self::class, 'source_measurement_id');
    }

    public function statuses(): HasMany
    {
        return $this->hasMany(MeasurementStatus::class, 'drawing_measurement_id');
    }
}
