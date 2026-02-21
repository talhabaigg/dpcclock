<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConditionLineItem extends Model
{
    protected $fillable = [
        'takeoff_condition_id',
        'sort_order',
        'section',
        'entry_type',
        'material_item_id',
        'labour_cost_code_id',
        'item_code',
        'description',
        'qty_source',
        'fixed_qty',
        'oc_spacing',
        'layers',
        'waste_percentage',
        'unit_cost',
        'cost_source',
        'uom',
        'pack_size',
        'hourly_rate',
        'production_rate',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'layers' => 'integer',
        'fixed_qty' => 'float',
        'oc_spacing' => 'float',
        'waste_percentage' => 'float',
        'unit_cost' => 'float',
        'pack_size' => 'float',
        'hourly_rate' => 'float',
        'production_rate' => 'float',
    ];

    public function condition(): BelongsTo
    {
        return $this->belongsTo(TakeoffCondition::class, 'takeoff_condition_id');
    }

    public function materialItem(): BelongsTo
    {
        return $this->belongsTo(MaterialItem::class);
    }

    public function labourCostCode(): BelongsTo
    {
        return $this->belongsTo(LabourCostCode::class);
    }
}
