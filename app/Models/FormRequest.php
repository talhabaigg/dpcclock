<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class FormRequest extends Model
{
    protected $fillable = [
        'form_template_id',
        'formable_type',
        'formable_id',
        'token',
        'status',
        'delivery_method',
        'recipient_name',
        'recipient_email',
        'responses',
        'sent_by',
        'submitted_at',
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

    public function sentBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
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
}
