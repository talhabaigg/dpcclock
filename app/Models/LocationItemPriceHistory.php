<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LocationItemPriceHistory extends Model
{
    public $timestamps = false;

    protected $table = 'location_item_price_history';

    protected $fillable = [
        'location_id',
        'material_item_id',
        'unit_cost_override',
        'previous_unit_cost',
        'is_locked',
        'previous_is_locked',
        'changed_by',
        'change_type',
    ];

    protected $casts = [
        'unit_cost_override' => 'decimal:6',
        'previous_unit_cost' => 'decimal:6',
        'is_locked' => 'boolean',
        'previous_is_locked' => 'boolean',
        'created_at' => 'datetime',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function materialItem(): BelongsTo
    {
        return $this->belongsTo(MaterialItem::class);
    }

    public function changedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }

    /**
     * Log a price history entry.
     */
    public static function log(
        int $locationId,
        int $materialItemId,
        float $unitCostOverride,
        bool $isLocked,
        ?int $changedBy,
        string $changeType,
        ?float $previousUnitCost = null,
        ?bool $previousIsLocked = null
    ): self {
        return self::create([
            'location_id' => $locationId,
            'material_item_id' => $materialItemId,
            'unit_cost_override' => $unitCostOverride,
            'previous_unit_cost' => $previousUnitCost,
            'is_locked' => $isLocked,
            'previous_is_locked' => $previousIsLocked,
            'changed_by' => $changedBy,
            'change_type' => $changeType,
        ]);
    }
}
