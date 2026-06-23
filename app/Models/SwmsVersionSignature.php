<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class SwmsVersionSignature extends Pivot implements HasMedia
{
    use InteractsWithMedia;

    protected $table = 'swms_version_signatures';

    public $incrementing = true;

    public $timestamps = true;

    protected $fillable = [
        'swms_version_id',
        'employee_id',
        'signed_at',
        'original_signed_at',
        'carried_from_version_id',
    ];

    protected $casts = [
        'signed_at' => 'datetime',
        'original_signed_at' => 'datetime',
    ];

    protected $appends = ['signature_url'];

    public function version(): BelongsTo
    {
        return $this->belongsTo(SwmsVersion::class, 'swms_version_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function carriedFromVersion(): BelongsTo
    {
        return $this->belongsTo(SwmsVersion::class, 'carried_from_version_id');
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('signature')->singleFile();
    }

    public function getSignatureUrlAttribute(): ?string
    {
        $media = $this->getFirstMedia('signature');

        return $media ? $this->mediaUrl($media) : null;
    }

    protected function mediaUrl(Media $media): ?string
    {
        if ($media->disk === 's3') {
            try {
                return $media->getTemporaryUrl(now()->addMinutes(60));
            } catch (\Throwable $e) {
                return null;
            }
        }

        return $media->getUrl();
    }
}
