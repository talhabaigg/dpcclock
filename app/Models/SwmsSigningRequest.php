<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class SwmsSigningRequest extends Model
{
    use HasUuids, LogsActivity, SoftDeletes;

    public const STATUS_PENDING = 'pending';
    public const STATUS_OPENED = 'opened';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_EXPIRED = 'expired';

    public const DELIVERY_IPAD = 'ipad';
    public const DELIVERY_QR = 'qr';
    public const DELIVERY_SMS = 'sms';

    protected $fillable = [
        'token',
        'location_id',
        'delivery_method',
        'recipient_phone',
        'status',
        'expires_at',
        'completed_at',
        'created_by',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if (! $model->token) {
                $model->token = Str::random(48);
            }
            if (! $model->expires_at) {
                $model->expires_at = now()->addDays(7);
            }
            if ($model->created_by === null && auth()->check()) {
                $model->created_by = auth()->id();
            }
        });
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnlyDirty()
            ->logFillable()
            ->useLogName('swms_signing_request');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function versions(): BelongsToMany
    {
        return $this->belongsToMany(
            SwmsVersion::class,
            'swms_signing_request_versions',
            'swms_signing_request_id',
            'swms_version_id'
        )->withTimestamps();
    }

    public function employees(): BelongsToMany
    {
        return $this->belongsToMany(
            Employee::class,
            'swms_signing_request_employees',
            'swms_signing_request_id',
            'employee_id'
        )->withPivot('signed_at')->withTimestamps();
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function isComplete(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    public function publicUrl(): string
    {
        return url("/swms-sign/{$this->token}");
    }

    /**
     * Mark the request completed if every employee in it has signed_at populated.
     */
    public function recomputeCompletion(): void
    {
        $remaining = $this->employees()->wherePivotNull('signed_at')->count();
        if ($remaining === 0) {
            $this->status = self::STATUS_COMPLETED;
            $this->completed_at = now();
            $this->save();
        }
    }
}
