<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SigningAuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'signing_request_id',
        'event',
        'actor_type',
        'actor_id',
        'ip_address',
        'user_agent',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function signingRequest(): BelongsTo
    {
        return $this->belongsTo(SigningRequest::class);
    }
}
