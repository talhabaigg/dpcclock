<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeasurementSegmentStatus extends Model
{
    protected $fillable = [
        'watermelon_id',
        'drawing_measurement_id',
        'labour_cost_code_id',
        'segment_index',
        'percent_complete',
        'work_date',
        'updated_by',
    ];

    protected $casts = [
        'percent_complete' => 'integer',
        'segment_index' => 'integer',
        'work_date' => 'date',
    ];

    public function measurement(): BelongsTo
    {
        return $this->belongsTo(DrawingMeasurement::class, 'drawing_measurement_id');
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
