<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyPrestartSignature extends Model
{
    protected $fillable = [
        'daily_prestart_id',
        'employee_id',
        'employment_type',
        'guest_name',
        'guest_company',
        'signature',
        'content_snapshot',
        'signed_at',
        'signed_out_at',
        'clock_id',
    ];

    protected $casts = [
        'content_snapshot' => 'array',
        'signed_at' => 'datetime',
        'signed_out_at' => 'datetime',
    ];

    protected $appends = ['is_guest', 'display_name'];

    protected static function booted(): void
    {
        static::creating(function (self $row): void {
            if ($row->employment_type === null && $row->employee_id !== null) {
                $row->employment_type = Employee::query()
                    ->whereKey($row->employee_id)
                    ->value('employment_type');
            }
        });
    }

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
