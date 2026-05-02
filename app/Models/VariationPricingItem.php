<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VariationPricingItem extends Model
{
    public const SOURCE_MANUAL = 'manual';

    public const SOURCE_MEASUREMENT = 'measurement';

    protected $fillable = [
        'variation_id',
        'takeoff_condition_id',
        'drawing_measurement_id',
        'source',
        'description',
        'qty',
        'unit',
        'labour_cost',
        'material_cost',
        'total_cost',
        'sell_rate',
        'sell_total',
        'sort_order',
        'last_synced_at',
    ];

    protected $casts = [
        'qty' => 'float',
        'labour_cost' => 'float',
        'material_cost' => 'float',
        'total_cost' => 'float',
        'sell_rate' => 'float',
        'sell_total' => 'float',
        'sort_order' => 'integer',
        'last_synced_at' => 'datetime',
    ];

    protected $attributes = [
        'source' => self::SOURCE_MANUAL,
    ];

    public function variation(): BelongsTo
    {
        return $this->belongsTo(Variation::class);
    }

    public function condition(): BelongsTo
    {
        return $this->belongsTo(TakeoffCondition::class, 'takeoff_condition_id');
    }

    public function measurement(): BelongsTo
    {
        return $this->belongsTo(DrawingMeasurement::class, 'drawing_measurement_id');
    }

    public function isManual(): bool
    {
        return $this->source === self::SOURCE_MANUAL;
    }

    public function isAggregated(): bool
    {
        return $this->source === self::SOURCE_MEASUREMENT && $this->drawing_measurement_id === null;
    }

    public function isUnpriced(): bool
    {
        return $this->source === self::SOURCE_MEASUREMENT && $this->drawing_measurement_id !== null;
    }

    public function flavour(): string
    {
        if ($this->isManual()) {
            return 'manual';
        }

        return $this->isUnpriced() ? 'unpriced' : 'aggregated';
    }
}
