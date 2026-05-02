<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class Drawing extends Model implements HasMedia
{
    use HasFactory, InteractsWithMedia, SoftDeletes;

    protected $table = 'drawings';

    protected $fillable = [
        'watermelon_id',
        'project_id',
        'sheet_number',
        'title',
        'revision_number',
        'status',
        'previous_revision_id',
        'tiles_width',
        'tiles_height',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'tiles_width' => 'integer',
        'tiles_height' => 'integer',
    ];

    protected $appends = [
        'file_url',
        'thumbnail_url',
        'display_name',
    ];

    // Workflow status constants
    const STATUS_DRAFT = 'draft';

    const STATUS_PROCESSING = 'processing';

    const STATUS_PENDING_REVIEW = 'pending_review';

    const STATUS_ACTIVE = 'active';

    const STATUS_SUPERSEDED = 'superseded';

    const STATUS_ARCHIVED = 'archived';

    protected static function booted()
    {
        static::creating(function ($model) {
            if ($model->created_by === null) {
                $model->created_by = auth()->id();
            }
            if (! $model->status) {
                $model->status = self::STATUS_DRAFT;
            }
        });

        static::updating(function ($model) {
            $model->updated_by = auth()->id();
        });
    }

    // Media collections + conversions

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('source')->singleFile();
        $this->addMediaCollection('thumbnail')->singleFile();
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        // For images in the source collection, Spatie auto-generates the thumb conversion.
        // PDFs are converted to thumbnails explicitly in ProcessDrawingJob and stored
        // in the separate `thumbnail` collection (Spatie v11 can't render PDFs natively).
        $this->addMediaConversion('thumb')
            ->format('png')
            ->width(1200)
            ->performOnCollections('source')
            ->nonOptimized();
    }

    // Relationships

    public function project()
    {
        return $this->belongsTo(Location::class, 'project_id');
    }

    public function observations()
    {
        return $this->hasMany(DrawingObservation::class, 'drawing_id');
    }

    public function measurements()
    {
        return $this->hasMany(DrawingMeasurement::class, 'drawing_id');
    }

    public function scaleCalibration()
    {
        return $this->hasOne(DrawingScaleCalibration::class, 'drawing_id');
    }

    public function previousRevision()
    {
        return $this->belongsTo(self::class, 'previous_revision_id');
    }

    public function nextRevision()
    {
        return $this->hasOne(self::class, 'previous_revision_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    // Accessors

    public function getFileUrlAttribute(): ?string
    {
        $media = $this->getFirstMedia('source');

        return $media ? $this->mediaUrl($media) : null;
    }

    public function getThumbnailUrlAttribute(): ?string
    {
        // Prefer the explicitly-generated thumbnail (PDFs render here)
        $thumbnail = $this->getFirstMedia('thumbnail');
        if ($thumbnail) {
            return $this->mediaUrl($thumbnail);
        }

        // For image sources, use Spatie's auto-generated thumb conversion
        $source = $this->getFirstMedia('source');
        if (! $source) {
            return null;
        }

        if ($source->hasGeneratedConversion('thumb')) {
            return $this->mediaUrl($source, 'thumb');
        }

        // Only fall back to the original source file if it's an image
        if (str_starts_with(strtolower($source->mime_type ?? ''), 'image/')) {
            return $this->mediaUrl($source);
        }

        return null;
    }

    /**
     * Build a fetchable URL for a media file. Uses a presigned temporary URL
     * for S3 (private buckets); falls back to the public URL otherwise.
     */
    protected function mediaUrl(\Spatie\MediaLibrary\MediaCollections\Models\Media $media, string $conversion = ''): ?string
    {
        if ($media->disk === 's3') {
            try {
                return $media->getTemporaryUrl(now()->addMinutes(60), $conversion);
            } catch (\Throwable $e) {
                return null;
            }
        }

        return $conversion === '' ? $media->getUrl() : $media->getUrl($conversion);
    }

    public function getDisplayNameAttribute(): string
    {
        if ($this->sheet_number && $this->title) {
            return "{$this->sheet_number} - {$this->title}";
        }

        if ($this->sheet_number) {
            return $this->sheet_number;
        }

        if ($this->title) {
            return $this->title;
        }

        $media = $this->getFirstMedia('source');
        if ($media?->file_name) {
            return $media->file_name;
        }

        return "Drawing #{$this->id}";
    }

    public function getIsPdfAttribute(): bool
    {
        $media = $this->getFirstMedia('source');

        if (! $media) {
            return false;
        }

        return str_contains(strtolower($media->mime_type ?? ''), 'pdf');
    }

    public function getIsImageAttribute(): bool
    {
        $media = $this->getFirstMedia('source');

        if (! $media) {
            return false;
        }

        return str_starts_with(strtolower($media->mime_type ?? ''), 'image/');
    }

    // Scopes

    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    public function scopeNotArchived($query)
    {
        return $query->where('status', '!=', self::STATUS_ARCHIVED);
    }

    // Methods

    public function isCurrentRevision(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function isSuperseded(): bool
    {
        return $this->status === self::STATUS_SUPERSEDED;
    }

    /**
     * Get all revisions of the same sheet (grouped by sheet_number + project_id).
     */
    public function getSiblingRevisions()
    {
        if (! $this->sheet_number || ! $this->project_id) {
            return collect([$this]);
        }

        return self::where('project_id', $this->project_id)
            ->where('sheet_number', $this->sheet_number)
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Mark this revision as active and supersede others with the same sheet_number.
     */
    public function makeActive(): void
    {
        if ($this->sheet_number && $this->project_id) {
            self::where('project_id', $this->project_id)
                ->where('sheet_number', $this->sheet_number)
                ->where('id', '!=', $this->id)
                ->where('status', self::STATUS_ACTIVE)
                ->update(['status' => self::STATUS_SUPERSEDED]);
        }

        $this->status = self::STATUS_ACTIVE;
        $this->save();
    }

    /**
     * Add a new revision for this sheet. Supersedes the current active revision.
     */
    public static function addRevision(
        int $projectId,
        string $sheetNumber,
        self $newDrawing,
        ?string $revisionNumber = null
    ): void {
        $currentActive = self::where('project_id', $projectId)
            ->where('sheet_number', $sheetNumber)
            ->where('status', self::STATUS_ACTIVE)
            ->first();

        if ($currentActive) {
            $currentActive->update(['status' => self::STATUS_SUPERSEDED]);
            $newDrawing->previous_revision_id = $currentActive->id;
        }

        if (! $revisionNumber) {
            $revisionNumber = self::getNextRevisionNumber($projectId, $sheetNumber);
        }

        $newDrawing->sheet_number = $sheetNumber;
        $newDrawing->project_id = $projectId;
        $newDrawing->revision_number = $revisionNumber;
        $newDrawing->status = self::STATUS_ACTIVE;
        $newDrawing->save();

        // Carry the previous revision's scale calibration forward so the
        // estimator doesn't have to re-calibrate on every revision upload.
        if ($currentActive && $newDrawing->scaleCalibration === null) {
            $prev = $currentActive->scaleCalibration;
            if ($prev) {
                $newDrawing->scaleCalibration()->create([
                    'method' => $prev->method,
                    'point_a_x' => $prev->point_a_x,
                    'point_a_y' => $prev->point_a_y,
                    'point_b_x' => $prev->point_b_x,
                    'point_b_y' => $prev->point_b_y,
                    'real_distance' => $prev->real_distance,
                    'paper_size' => $prev->paper_size,
                    'drawing_scale' => $prev->drawing_scale,
                    'unit' => $prev->unit,
                    'pixels_per_unit' => $prev->pixels_per_unit,
                    'created_by' => auth()->id(),
                ]);
            }
        }
    }

    /**
     * Get the next revision number for a sheet (A, B, C... or 1, 2, 3...).
     */
    public static function getNextRevisionNumber(int $projectId, string $sheetNumber): string
    {
        $lastRevision = self::where('project_id', $projectId)
            ->where('sheet_number', $sheetNumber)
            ->whereNotNull('revision_number')
            ->orderBy('created_at', 'desc')
            ->first();

        if (! $lastRevision || ! $lastRevision->revision_number) {
            return 'A';
        }

        $current = $lastRevision->revision_number;

        if (is_numeric($current)) {
            return (string) ((int) $current + 1);
        }

        if (preg_match('/^[A-Z]+$/', $current)) {
            return self::incrementLetterRevision($current);
        }

        return 'A';
    }

    private static function incrementLetterRevision(string $letters): string
    {
        $letters = strtoupper($letters);
        $length = strlen($letters);

        for ($i = $length - 1; $i >= 0; $i--) {
            if ($letters[$i] !== 'Z') {
                $letters[$i] = chr(ord($letters[$i]) + 1);

                return $letters;
            }
            $letters[$i] = 'A';
        }

        return 'A'.$letters;
    }

}
