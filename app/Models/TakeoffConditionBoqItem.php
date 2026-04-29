<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TakeoffConditionBoqItem extends Model
{
    protected $table = 'takeoff_condition_boq_items';

    protected $fillable = [
        'takeoff_condition_id',
        'kind',
        'cost_code_id',
        'labour_cost_code_id',
        'unit_rate',
        'production_rate',
        'notes',
        'sort_order',
    ];

    protected $casts = [
        'unit_rate' => 'float',
        'production_rate' => 'float',
        'sort_order' => 'integer',
    ];

    protected $appends = ['legacy_unmapped'];

    public function condition(): BelongsTo
    {
        return $this->belongsTo(TakeoffCondition::class, 'takeoff_condition_id');
    }

    public function costCode(): BelongsTo
    {
        return $this->belongsTo(CostCode::class);
    }

    public function labourCostCode(): BelongsTo
    {
        return $this->belongsTo(LabourCostCode::class);
    }

    /**
     * A labour row carried forward from the old single-rate shape that hasn't
     * been linked to a labour cost code yet. Surfaced in the UI as a "Legacy
     * rate" badge so estimators can resolve it on next edit.
     */
    public function getLegacyUnmappedAttribute(): bool
    {
        return $this->kind === 'labour' && $this->labour_cost_code_id === null;
    }
}
