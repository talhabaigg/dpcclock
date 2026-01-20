<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VoiceCallSession extends Model
{
    protected $fillable = [
        'user_id',
        'session_id',
        'started_at',
        'ended_at',
        'duration_seconds',
        'estimated_cost',
        'status',
        'metadata',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'estimated_cost' => 'decimal:4',
        'metadata' => 'array',
    ];

    /**
     * Get the user that owns the voice call session.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope to get active sessions.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope to get completed sessions.
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Calculate the duration in minutes.
     */
    public function getDurationMinutesAttribute(): float
    {
        return round($this->duration_seconds / 60, 2);
    }

    /**
     * End the session and calculate duration.
     */
    public function end(): void
    {
        $this->ended_at = now();
        $this->duration_seconds = $this->started_at->diffInSeconds($this->ended_at);
        $this->status = 'completed';

        // OpenAI Realtime API pricing: approximately $0.06/min for audio
        // This is an estimate - actual pricing may vary
        $this->estimated_cost = ($this->duration_seconds / 60) * 0.06;

        $this->save();
    }
}
