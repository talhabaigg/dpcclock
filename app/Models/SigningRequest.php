<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Http\Request;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class SigningRequest extends Model implements HasMedia
{
    use InteractsWithMedia;

    protected $fillable = [
        'document_template_id',
        'document_title',
        'signable_type',
        'signable_id',
        'delivery_method',
        'token',
        'status',
        'sent_by',
        'document_html',
        'document_hash',
        'recipient_name',
        'recipient_email',
        'custom_fields',
        'sender_signature',
        'sender_full_name',
        'sender_position',
        'internal_signer_user_id',
        'internal_signer_token',
        'internal_signed_at',
        'signer_full_name',
        'signer_ip_address',
        'signer_user_agent',
        'signed_at',
        'expires_at',
        'opened_at',
        'viewed_at',
        'cancelled_at',
        'cancelled_by',
    ];

    protected function casts(): array
    {
        return [
            'custom_fields' => 'array',
            'signed_at' => 'datetime',
            'expires_at' => 'datetime',
            'opened_at' => 'datetime',
            'viewed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'internal_signed_at' => 'datetime',
        ];
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('signature')->singleFile();
        $this->addMediaCollection('initials')->singleFile();
        $this->addMediaCollection('preview_document')->singleFile();
        $this->addMediaCollection('signed_document')->singleFile();
        $this->addMediaCollection('internal_signature')->singleFile();
    }

    public function documentTemplate(): BelongsTo
    {
        return $this->belongsTo(DocumentTemplate::class);
    }

    public function signable(): MorphTo
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

    public function internalSigner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'internal_signer_user_id');
    }

    public function isAwaitingInternalSignature(): bool
    {
        return $this->status === 'awaiting_internal_signature';
    }

    public function getInternalSigningUrl(): string
    {
        return url("/internal-sign/{$this->internal_signer_token}");
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(SigningAuditLog::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    public function isSigned(): bool
    {
        return $this->status === 'signed';
    }

    public function isPending(): bool
    {
        return in_array($this->status, ['pending', 'sent', 'opened', 'viewed']);
    }

    public function isCancelled(): bool
    {
        return $this->status === 'cancelled';
    }

    public function getSigningUrl(): string
    {
        return url("/sign/{$this->token}");
    }

    public function logEvent(string $event, ?string $actorType = null, ?int $actorId = null, ?Request $request = null, ?array $metadata = null): SigningAuditLog
    {
        return $this->auditLogs()->create([
            'event' => $event,
            'actor_type' => $actorType,
            'actor_id' => $actorId,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'metadata' => $metadata,
        ]);
    }
}
