<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LabourForecast extends Model
{
    protected $fillable = [
        'location_id',
        'forecast_month',
        'status',
        'created_by',
        'submitted_by',
        'submitted_at',
        'approved_by',
        'approved_at',
        'notes',
        'rejection_reason',
    ];

    protected $casts = [
        'forecast_month' => 'date',
        'submitted_at' => 'datetime',
        'approved_at' => 'datetime',
    ];

    /**
     * Status constants
     */
    const STATUS_DRAFT = 'draft';
    const STATUS_SUBMITTED = 'submitted';
    const STATUS_APPROVED = 'approved';
    const STATUS_REJECTED = 'rejected';

    /**
     * Get the location this forecast belongs to
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    /**
     * Get the user who created this forecast
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who submitted this forecast
     */
    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    /**
     * Get the user who approved this forecast
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Get the forecast entries (headcount per week per template)
     */
    public function entries(): HasMany
    {
        return $this->hasMany(LabourForecastEntry::class);
    }

    /**
     * Check if the forecast is editable (only drafts can be edited)
     */
    public function isEditable(): bool
    {
        return $this->status === self::STATUS_DRAFT;
    }

    /**
     * Check if the forecast can be submitted
     */
    public function canBeSubmitted(): bool
    {
        return $this->status === self::STATUS_DRAFT;
    }

    /**
     * Check if the forecast can be approved
     */
    public function canBeApproved(): bool
    {
        return $this->status === self::STATUS_SUBMITTED;
    }

    /**
     * Submit the forecast for approval
     */
    public function submit(User $user): void
    {
        $this->update([
            'status' => self::STATUS_SUBMITTED,
            'submitted_by' => $user->id,
            'submitted_at' => now(),
        ]);
    }

    /**
     * Approve the forecast
     */
    public function approve(User $user): void
    {
        $this->update([
            'status' => self::STATUS_APPROVED,
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);
    }

    /**
     * Reject the forecast
     */
    public function reject(User $user, string $reason): void
    {
        $this->update([
            'status' => self::STATUS_REJECTED,
            'rejection_reason' => $reason,
        ]);
    }

    /**
     * Revert to draft (after rejection or for revisions)
     */
    public function revertToDraft(): void
    {
        $this->update([
            'status' => self::STATUS_DRAFT,
            'submitted_by' => null,
            'submitted_at' => null,
            'approved_by' => null,
            'approved_at' => null,
            'rejection_reason' => null,
        ]);
    }

    /**
     * Calculate total cost for this forecast
     */
    public function getTotalCost(): float
    {
        return $this->entries->sum(function ($entry) {
            return $entry->headcount * ($entry->weekly_cost ?? 0);
        });
    }

    /**
     * Calculate total headcount (person-weeks) for this forecast
     */
    public function getTotalHeadcount(): int
    {
        return $this->entries->sum('headcount');
    }
}
