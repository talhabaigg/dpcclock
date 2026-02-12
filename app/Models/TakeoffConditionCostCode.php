<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TakeoffConditionCostCode extends Model
{
    protected $fillable = [
        'takeoff_condition_id',
        'cost_code_id',
        'unit_rate',
    ];

    protected $casts = [
        'unit_rate' => 'float',
    ];

    public function condition(): BelongsTo
    {
        return $this->belongsTo(TakeoffCondition::class, 'takeoff_condition_id');
    }

    public function costCode(): BelongsTo
    {
        return $this->belongsTo(CostCode::class);
    }
}
