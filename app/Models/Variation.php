<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Variation extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'co_number',
        'type',
        'description',
        'status',
        'co_date',
        'created_by',
        'updated_by',
        'deleted_by',
        'location_id',
        'drawing_id',
        'premier_co_id',
        'markup_percentage',
        'client_notes',
    ];

    protected $casts = [
        'markup_percentage' => 'float',
    ];

    public function lineItems(): HasMany
    {
        return $this->hasMany(VariationLineItem::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function drawing(): BelongsTo
    {
        return $this->belongsTo(Drawing::class);
    }

    public function measurements(): HasMany
    {
        return $this->hasMany(DrawingMeasurement::class);
    }

    public function pricingItems(): HasMany
    {
        return $this->hasMany(VariationPricingItem::class)->orderBy('sort_order');
    }
}
