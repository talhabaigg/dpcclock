<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VariationPricingItem extends Model
{
    protected $fillable = [
        'variation_id',
        'takeoff_condition_id',
        'description',
        'qty',
        'unit',
        'labour_cost',
        'material_cost',
        'total_cost',
        'sell_rate',
        'sell_total',
        'sort_order',
    ];

    protected $casts = [
        'qty' => 'float',
        'labour_cost' => 'float',
        'material_cost' => 'float',
        'total_cost' => 'float',
        'sell_rate' => 'float',
        'sell_total' => 'float',
        'sort_order' => 'integer',
    ];

    public function variation(): BelongsTo
    {
        return $this->belongsTo(Variation::class);
    }

    public function condition(): BelongsTo
    {
        return $this->belongsTo(TakeoffCondition::class, 'takeoff_condition_id');
    }
}
