<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VariationDirectMaterial extends Model
{
    protected $fillable = [
        'variation_id',
        'supplier_id',
        'material_item_id',
        'material_code',
        'material_description',
        'cost_code_id',
        'cost_type',
        'description',
        'qty',
        'unit_cost',
        'sell_markup_pct',
        'client_markup_pct',
        'sell_cost',
        'line_number',
        'sort_order',
    ];

    protected $casts = [
        'qty' => 'float',
        'unit_cost' => 'float',
        'sell_markup_pct' => 'float',
        'client_markup_pct' => 'float',
        'sell_cost' => 'float',
        'line_number' => 'integer',
        'sort_order' => 'integer',
    ];

    public function variation(): BelongsTo
    {
        return $this->belongsTo(Variation::class);
    }

    public function materialItem(): BelongsTo
    {
        return $this->belongsTo(MaterialItem::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function costCode(): BelongsTo
    {
        return $this->belongsTo(CostCode::class);
    }

    /**
     * Fields whose changes invalidate the parent variation's Premier lines.
     * sell_markup_pct, client_markup_pct, sell_cost are sell-side only and
     * don't affect the cost basis Premier emits, so they're excluded.
     */
    private const PREMIER_AFFECTING_FIELDS = [
        'cost_code_id',
        'qty',
        'unit_cost',
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
