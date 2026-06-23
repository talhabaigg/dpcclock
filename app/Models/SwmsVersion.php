<?php

namespace App\Models;

use App\Enums\SwmsVersionStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class SwmsVersion extends Model implements HasMedia
{
    use HasUuids, InteractsWithMedia, LogsActivity, SoftDeletes;

    protected $fillable = [
        'swms_id',
        'version_number',
        'status',
        'supersedes_id',
        'requires_resignature',
        'change_summary',
        'approved_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'status' => SwmsVersionStatus::class,
        'requires_resignature' => 'boolean',
        'approved_at' => 'datetime',
    ];

    protected $appends = ['document_url', 'document_filename'];

    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if ($model->created_by === null && auth()->check()) {
                $model->created_by = auth()->id();
            }
            if (! $model->status) {
                $model->status = SwmsVersionStatus::Draft;
            }
        });

        static::updating(function (self $model) {
            if (auth()->check()) {
                $model->updated_by = auth()->id();
            }
        });
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnlyDirty()
            ->logFillable()
            ->useLogName('swms_version');
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('document')->singleFile();
    }

    public function swms(): BelongsTo
    {
        return $this->belongsTo(Swms::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function previousVersion(): BelongsTo
    {
        return $this->belongsTo(self::class, 'supersedes_id');
    }

    public function nextVersion(): HasOne
    {
        return $this->hasOne(self::class, 'supersedes_id');
    }

    public function signatures(): HasMany
    {
        return $this->hasMany(SwmsVersionSignature::class);
    }

    public function signers(): BelongsToMany
    {
        return $this->belongsToMany(Employee::class, 'swms_version_signatures')
            ->using(SwmsVersionSignature::class)
            ->withPivot('id', 'signed_at', 'original_signed_at', 'carried_from_version_id')
            ->withTimestamps();
    }

    public function scopeActive($query)
    {
        return $query->where('status', SwmsVersionStatus::Active->value);
    }

    public function scopeNotArchived($query)
    {
        return $query->where('status', '!=', SwmsVersionStatus::Archived->value);
    }

    public function getDocumentUrlAttribute(): ?string
    {
        $media = $this->getFirstMedia('document');

        return $media ? $this->mediaUrl($media) : null;
    }

    public function getDocumentFilenameAttribute(): ?string
    {
        return $this->getFirstMedia('document')?->file_name;
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

    /**
     * Promote this version to active, supersede any prior active versions in the same SWMS,
     * and carry signatures forward from the prior active version when
     * `requires_resignature` is false.
     */
    public function makeActive(): void
    {
        $prior = self::where('swms_id', $this->swms_id)
            ->where('id', '!=', $this->id)
            ->where('status', SwmsVersionStatus::Active->value)
            ->get();

        foreach ($prior as $old) {
            $old->status = SwmsVersionStatus::Superseded;
            $old->save();
        }

        if (! $this->supersedes_id && $prior->isNotEmpty()) {
            $this->supersedes_id = $prior->first()->id;
        }

        $this->status = SwmsVersionStatus::Active;
        $this->save();

        if (! $this->requires_resignature && $prior->isNotEmpty()) {
            foreach ($prior as $old) {
                $this->carrySignaturesFrom($old);
            }
        }
    }

    /**
     * Copy each signature from the source version into this version, duplicating the
     * underlying signature media file so each version remains self-contained.
     */
    public function carrySignaturesFrom(self $source): void
    {
        $source->loadMissing('signatures.media');

        foreach ($source->signatures as $sig) {
            $exists = SwmsVersionSignature::where('swms_version_id', $this->id)
                ->where('employee_id', $sig->employee_id)
                ->exists();

            if ($exists) {
                continue;
            }

            $new = $this->signatures()->create([
                'employee_id' => $sig->employee_id,
                'signed_at' => now(),
                'original_signed_at' => $sig->original_signed_at ?? $sig->signed_at,
                'carried_from_version_id' => $sig->swms_version_id,
            ]);

            $sourceMedia = $sig->getFirstMedia('signature');
            if ($sourceMedia) {
                $sourceMedia->copy($new, 'signature');
            }
        }
    }

    public function isActive(): bool
    {
        return $this->status === SwmsVersionStatus::Active;
    }

    public function isSuperseded(): bool
    {
        return $this->status === SwmsVersionStatus::Superseded;
    }

    public function isArchived(): bool
    {
        return $this->status === SwmsVersionStatus::Archived;
    }
}
