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
        'premier_cost_per_unit',
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
        'premier_cost_per_unit' => 'float',
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

    /**
     * Fields whose changes invalidate the parent variation's premier lines.
     * sell_rate, sell_total, description, premier_cost_per_unit don't affect
     * Premier output and are intentionally excluded.
     */
    private const PREMIER_AFFECTING_FIELDS = [
        'labour_cost',
        'material_cost',
        'qty',
        'takeoff_condition_id',
        'sort_order',
    ];

    protected static function booted(): void
    {
        static::created(fn (self $item) => self::markVariationStale($item->variation_id));

        static::updated(function (self $item) {
            if ($item->wasChanged(self::PREMIER_AFFECTING_FIELDS)) {
                self::markVariationStale($item->variation_id);
            }
        });

        static::deleted(fn (self $item) => self::markVariationStale($item->variation_id));
    }

    private static function markVariationStale(?int $variationId): void
    {
        if (! $variationId) {
            return;
        }
        Variation::whereKey($variationId)->update(['premier_lines_stale' => true]);
    }
}
