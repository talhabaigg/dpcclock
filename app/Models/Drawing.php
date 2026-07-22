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
        'aconex_document_id',
        'aconex_version_number',
        'aconex_registered_at',
        'tiles_width',
        'tiles_height',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'tiles_width' => 'integer',
        'tiles_height' => 'integer',
        'aconex_version_number' => 'integer',
        'aconex_registered_at' => 'datetime',
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
        // Full-resolution render for PDF reports; generated lazily on first use.
        $this->addMediaCollection('hires')->singleFile();
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

    public function siteTasks()
    {
        return $this->hasMany(SiteTask::class, 'drawing_id');
    }

    public function observations()
    {
        return $this->hasMany(DrawingObservation::class, 'drawing_id');
    }

    public function annotations()
    {
        return $this->morphMany(Annotation::class, 'annotatable');
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
    protected function mediaUrl(Media $media, string $conversion = ''): ?string
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
     * Compare two revision identifiers: 1 < 2 < 10; A < B < Z < AA.
     * Returns <0 when $a is older than $b, >0 when newer, 0 when equal.
     * Mixed/unknown schemes fall back to natural string comparison.
     */
    public static function compareRevisions(?string $a, ?string $b): int
    {
        $a = strtoupper(trim((string) $a));
        $b = strtoupper(trim((string) $b));

        if ($a === $b) {
            return 0;
        }
        if ($a === '' || $b === '') {
            return $a === '' ? -1 : 1;
        }

        if (is_numeric($a) && is_numeric($b)) {
            return (int) $a <=> (int) $b;
        }

        if (preg_match('/^[A-Z]+$/', $a) && preg_match('/^[A-Z]+$/', $b)) {
            return [strlen($a), $a] <=> [strlen($b), $b];
        }

        return strnatcasecmp($a, $b);
    }

    /**
     * Add a new revision for this sheet. Supersedes the current active revision —
     * unless the given revision is older than the active one (an out-of-order
     * import, e.g. rev C fetched after rev F), which is stored as already-
     * superseded history so the newest revision stays active.
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

        // Prefer Aconex's own monotonic version sequence when both sides have
        // one — revision letters are only a fallback for manual uploads.
        $incomingIsOlder = false;
        if ($currentActive) {
            if ($newDrawing->aconex_version_number !== null && $currentActive->aconex_version_number !== null) {
                $incomingIsOlder = $newDrawing->aconex_version_number < $currentActive->aconex_version_number;
            } elseif ($revisionNumber !== null) {
                $incomingIsOlder = self::compareRevisions($revisionNumber, $currentActive->revision_number) < 0;
            }
        }

        if ($incomingIsOlder) {
            $newDrawing->project_id = $projectId;
            $newDrawing->sheet_number = $sheetNumber;
            $newDrawing->revision_number = $revisionNumber;
            $newDrawing->status = self::STATUS_SUPERSEDED;
            $newDrawing->save();

            return;
        }

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
        // Highest by revision order, not import order — out-of-order imports
        // mean the newest created_at isn't necessarily the highest revision.
        $current = self::where('project_id', $projectId)
            ->where('sheet_number', $sheetNumber)
            ->whereNotNull('revision_number')
            ->pluck('revision_number')
            ->reduce(fn ($max, $rev) => $max === null || self::compareRevisions($rev, $max) > 0 ? $rev : $max);

        if (! $current) {
            return 'A';
        }

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
