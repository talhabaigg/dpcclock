<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class EmployeeFile extends Model implements HasMedia
{
    use InteractsWithMedia, SoftDeletes;

    protected $fillable = [
        'employee_id',
        'employee_file_type_id',
        'document_number',
        'expires_at',
        'completed_at',
        'uploaded_by',
        'notes',
    ];

    protected $casts = [
        'expires_at' => 'date',
        'completed_at' => 'date',
    ];

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('file_front')->singleFile();
        $this->addMediaCollection('file_back')->singleFile();
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function fileType(): BelongsTo
    {
        return $this->belongsTo(EmployeeFileType::class, 'employee_file_type_id');
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function isExpiringSoon(int $days = 30): bool
    {
        return $this->expires_at !== null
            && ! $this->expires_at->isPast()
            && $this->expires_at->lte(now()->addDays($days));
    }

    public function getStatus(): string
    {
        if ($this->isExpired()) {
            return 'expired';
        }
        if ($this->isExpiringSoon()) {
            return 'expiring_soon';
        }

        return 'valid';
    }

    public function getFrontUrl(): ?string
    {
        return $this->getMediaUrl('file_front');
    }

    public function getBackUrl(): ?string
    {
        return $this->getMediaUrl('file_back');
    }

    private function getMediaUrl(string $collection): ?string
    {
        $media = $this->getFirstMedia($collection);
        if (! $media) {
            return null;
        }

        if (app()->environment('production')) {
            return $media->getTemporaryUrl(now()->addMinutes(30));
        }

        return $media->getUrl();
    }

    public function scopeExpired($query)
    {
        return $query->where('expires_at', '<', now());
    }

    public function scopeExpiringSoon($query, int $days = 30)
    {
        return $query->whereBetween('expires_at', [now(), now()->addDays($days)]);
    }

    public function scopeValid($query)
    {
        return $query->where(function ($q) {
            $q->whereNull('expires_at')->orWhere('expires_at', '>=', now());
        });
    }
}
