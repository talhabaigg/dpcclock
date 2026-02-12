<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TakeoffConditionMaterial extends Model
{
    protected $fillable = [
        'takeoff_condition_id',
        'material_item_id',
        'qty_per_unit',
        'waste_percentage',
    ];

    protected $casts = [
        'qty_per_unit' => 'float',
        'waste_percentage' => 'float',
    ];

    public function condition(): BelongsTo
    {
        return $this->belongsTo(TakeoffCondition::class, 'takeoff_condition_id');
    }

    public function materialItem(): BelongsTo
    {
        return $this->belongsTo(MaterialItem::class);
    }
}
