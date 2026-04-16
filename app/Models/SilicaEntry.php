<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SilicaEntry extends Model
{
    protected $fillable = [
        'employee_id',
        'performed',
        'tasks',
        'duration_minutes',
        'swms_compliant',
        'control_measures',
        'respirator_type',
        'clock_out_date',
    ];

    protected $casts = [
        'performed' => 'boolean',
        'tasks' => 'array',
        'swms_compliant' => 'boolean',
        'control_measures' => 'array',
        'clock_out_date' => 'date',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
