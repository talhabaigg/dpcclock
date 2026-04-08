<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyPrestartSignature extends Model
{
    protected $fillable = [
        'daily_prestart_id',
        'employee_id',
        'signature',
        'content_snapshot',
        'signed_at',
        'clock_id',
    ];

    protected $casts = [
        'content_snapshot' => 'array',
        'signed_at' => 'datetime',
    ];

    // --- Relationships ---

    public function prestart(): BelongsTo
    {
        return $this->belongsTo(DailyPrestart::class, 'daily_prestart_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function clock(): BelongsTo
    {
        return $this->belongsTo(Clock::class);
    }
}
