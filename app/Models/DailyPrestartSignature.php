<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyPrestartSignature extends Model
{
    protected $fillable = [
        'daily_prestart_id',
        'employee_id',
        'guest_name',
        'guest_company',
        'signature',
        'content_snapshot',
        'signed_at',
        'clock_id',
    ];

    protected $casts = [
        'content_snapshot' => 'array',
        'signed_at' => 'datetime',
    ];

    protected $appends = ['is_guest', 'display_name'];

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

    public function getIsGuestAttribute(): bool
    {
        return $this->employee_id === null;
    }

    public function getDisplayNameAttribute(): ?string
    {
        if ($this->is_guest) {
            return $this->guest_name;
        }

        return $this->employee?->display_name ?? $this->employee?->name;
    }
}
