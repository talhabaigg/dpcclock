<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class JobForecast extends Model
{
    protected $table = 'job_forecasts';

    protected $fillable = [
        'job_number',
        'forecast_month',
        'is_locked',
        'status',
        'created_by',
        'updated_by',
        'submitted_by',
        'submitted_at',
        'finalized_by',
        'finalized_at',
        'rejection_note',
    ];

    protected $casts = [
        'forecast_month' => 'date',
        'is_locked' => 'boolean',
        'submitted_at' => 'datetime',
        'finalized_at' => 'datetime',
    ];

    // Status constants
    public const STATUS_PENDING = 'pending';
    public const STATUS_DRAFT = 'draft';
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_FINALIZED = 'finalized';

    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_DRAFT,
        self::STATUS_SUBMITTED,
        self::STATUS_FINALIZED,
    ];

    // Relationships
    public function data(): HasMany
    {
        return $this->hasMany(JobForecastData::class, 'job_forecast_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function finalizer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'finalized_by');
    }

    // Scopes
    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    public function scopeDraft($query)
    {
        return $query->where('status', self::STATUS_DRAFT);
    }

    public function scopeSubmitted($query)
    {
        return $query->where('status', self::STATUS_SUBMITTED);
    }

    public function scopeFinalized($query)
    {
        return $query->where('status', self::STATUS_FINALIZED);
    }

    public function scopeEditable($query)
    {
        return $query->whereIn('status', [self::STATUS_PENDING, self::STATUS_DRAFT]);
    }

    public function scopeAwaitingReview($query)
    {
        return $query->where('status', self::STATUS_SUBMITTED);
    }

    // Status check helpers
    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isDraft(): bool
    {
        return $this->status === self::STATUS_DRAFT;
    }

    public function isSubmitted(): bool
    {
        return $this->status === self::STATUS_SUBMITTED;
    }

    public function isFinalized(): bool
    {
        return $this->status === self::STATUS_FINALIZED;
    }

    public function isEditable(): bool
    {
        return in_array($this->status, [self::STATUS_PENDING, self::STATUS_DRAFT]);
    }

    public function canBeSubmitted(): bool
    {
        return $this->status === self::STATUS_DRAFT;
    }

    public function canBeFinalized(): bool
    {
        return $this->status === self::STATUS_SUBMITTED;
    }

    public function canBeRejected(): bool
    {
        return $this->status === self::STATUS_SUBMITTED;
    }

    // Status transition methods
    public function markAsDraft(User $user): bool
    {
        if (!in_array($this->status, [self::STATUS_PENDING, self::STATUS_SUBMITTED])) {
            return false;
        }

        $this->status = self::STATUS_DRAFT;
        $this->updated_by = $user->id;
        $this->rejection_note = null;

        return $this->save();
    }

    public function submit(User $user): bool
    {
        if (!$this->canBeSubmitted()) {
            return false;
        }

        $this->status = self::STATUS_SUBMITTED;
        $this->submitted_by = $user->id;
        $this->submitted_at = now();
        $this->updated_by = $user->id;

        return $this->save();
    }

    public function finalize(User $user): bool
    {
        if (!$this->canBeFinalized()) {
            return false;
        }

        $this->status = self::STATUS_FINALIZED;
        $this->finalized_by = $user->id;
        $this->finalized_at = now();
        $this->is_locked = true;
        $this->updated_by = $user->id;

        return $this->save();
    }

    public function reject(User $user, ?string $reason = null): bool
    {
        if (!$this->canBeRejected()) {
            return false;
        }

        $this->status = self::STATUS_DRAFT;
        $this->rejection_note = $reason;
        $this->updated_by = $user->id;
        // Clear submission info on rejection
        $this->submitted_by = null;
        $this->submitted_at = null;

        return $this->save();
    }

    // Helper to get status label for display
    public function getStatusLabelAttribute(): string
    {
        return match ($this->status) {
            self::STATUS_PENDING => 'Pending',
            self::STATUS_DRAFT => 'Draft',
            self::STATUS_SUBMITTED => 'Submitted',
            self::STATUS_FINALIZED => 'Finalized',
            default => 'Unknown',
        };
    }

    // Helper to get status color for UI
    public function getStatusColorAttribute(): string
    {
        return match ($this->status) {
            self::STATUS_PENDING => 'gray',
            self::STATUS_DRAFT => 'yellow',
            self::STATUS_SUBMITTED => 'blue',
            self::STATUS_FINALIZED => 'green',
            default => 'gray',
        };
    }
}
