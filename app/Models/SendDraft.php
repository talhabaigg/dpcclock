<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class SendDraft extends Model
{
    protected $fillable = [
        'user_id',
        'signable_type',
        'signable_id',
        'recipient_name',
        'recipient_email',
        'delivery_method',
        'payload',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function signable(): MorphTo
    {
        return $this->morphTo();
    }
}
