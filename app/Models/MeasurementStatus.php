<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeasurementStatus extends Model
{
    protected $fillable = [
        'drawing_measurement_id',
        'labour_cost_code_id',
        'percent_complete',
        'updated_by',
    ];

    protected $casts = [
        'percent_complete' => 'integer',
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
