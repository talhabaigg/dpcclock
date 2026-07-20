<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class FormRequest extends Model implements HasMedia
{
    use InteractsWithMedia;

    protected $fillable = [
        'form_template_id',
        'formable_type',
        'formable_id',
        'subject_type',
        'subject_id',
        'token',
        'status',
        'delivery_method',
        'recipient_name',
        'recipient_email',
        'assignee_strategy',
        'assignee_permission',
        'assignee_user_id',
        'responses',
        'response_snapshot',
        'sent_by',
        'submitted_at',
        'submitted_by',
        'opened_at',
        'expires_at',
        'cancelled_at',
        'cancelled_by',
        'submitter_ip_address',
        'submitter_user_agent',
    ];

    protected function casts(): array
    {
        return [
            'responses' => 'array',
            'response_snapshot' => 'array',
            'submitted_at' => 'datetime',
            'opened_at' => 'datetime',
            'expires_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function formTemplate(): BelongsTo
    {
        return $this->belongsTo(FormTemplate::class);
    }

    public function formable(): MorphTo
    {
        return $this->morphTo();
    }

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    public function sentBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    public function assigneeUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_user_id');
    }

    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    /**
     * Who actually completed the form: the authenticated in-app submitter
     * when known, otherwise the creation-time recipient (token submissions).
     */
    public function submitterName(): ?string
    {
        return $this->submittedBy?->name ?? $this->recipient_name;
    }

    public function isSubmitted(): bool
    {
        return $this->status === 'submitted';
    }

    public function isPending(): bool
    {
        return in_array($this->status, ['pending', 'sent', 'opened']);
    }

    public function isCancelled(): bool
    {
        return $this->status === 'cancelled';
    }

    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    public function getFormUrl(): string
    {
        return url("/form/{$this->token}");
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('signatures');
    }
}
