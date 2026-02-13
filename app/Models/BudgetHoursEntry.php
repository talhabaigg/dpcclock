<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetHoursEntry extends Model
{
    protected $fillable = [
        'location_id',
        'bid_area_id',
        'labour_cost_code_id',
        'work_date',
        'used_hours',
        'percent_complete',
        'updated_by',
    ];

    protected $casts = [
        'work_date' => 'date',
        'used_hours' => 'float',
        'percent_complete' => 'float',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function bidArea(): BelongsTo
    {
        return $this->belongsTo(BidArea::class);
    }

    public function labourCostCode(): BelongsTo
    {
        return $this->belongsTo(LabourCostCode::class);
    }

    public function updatedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
