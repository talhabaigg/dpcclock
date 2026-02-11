<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class Drawing extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'drawings';

    protected $fillable = [
        'project_id',
        'sheet_number',
        'title',
        'discipline',
        'storage_path',
        'original_name',
        'mime_type',
        'file_size',
        'sha256',
        'metadata_confirmed',
        'revision_number',
        'revision_date',
        'revision_notes',
        'status',
        'previous_revision_id',
        'thumbnail_path',
        'ai_extracted_metadata',
        'page_dimensions',
        'diff_image_path',
        // Textract extraction fields
        'page_preview_s3_key',
        'thumbnail_s3_key',
        'page_width_px',
        'page_height_px',
        'page_orientation',
        'size_bucket',
        'drawing_number',
        'drawing_title',
        'revision',
        'extraction_status',
        'confidence_number',
        'confidence_title',
        'confidence_revision',
        'used_template_id',
        'extraction_raw',
        'extraction_errors',
        'extracted_at',
        'created_by',
        'updated_by',
        // Tile rendering columns for Leaflet viewer
        'tiles_base_url',
        'tiles_max_zoom',
        'tiles_width',
        'tiles_height',
        'tile_size',
        'tiles_status',
    ];

    protected $casts = [
        'revision_date' => 'date',
        'ai_extracted_metadata' => 'array',
        'page_dimensions' => 'array',
        'page_width_px' => 'integer',
        'page_height_px' => 'integer',
        'extraction_raw' => 'array',
        'extraction_errors' => 'array',
        'confidence_number' => 'float',
        'confidence_title' => 'float',
        'confidence_revision' => 'float',
        'extracted_at' => 'datetime',
        'tiles_max_zoom' => 'integer',
        'tiles_width' => 'integer',
        'tiles_height' => 'integer',
        'tile_size' => 'integer',
        'metadata_confirmed' => 'boolean',
    ];

    protected $appends = [
        'file_url',
        'thumbnail_url',
        'diff_image_url',
        'display_name',
        'pdf_url',
        'tiles_info',
        'page_preview_url',
        'display_revision',
    ];

    // Workflow status constants
    const STATUS_DRAFT = 'draft';

    const STATUS_PROCESSING = 'processing';

    const STATUS_PENDING_REVIEW = 'pending_review';

    const STATUS_ACTIVE = 'active';

    const STATUS_SUPERSEDED = 'superseded';

    const STATUS_ARCHIVED = 'archived';

    // Extraction status constants
    const EXTRACTION_QUEUED = 'queued';

    const EXTRACTION_PROCESSING = 'processing';

    const EXTRACTION_SUCCESS = 'success';

    const EXTRACTION_NEEDS_REVIEW = 'needs_review';

    const EXTRACTION_FAILED = 'failed';

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

    // Relationships

    public function project()
    {
        return $this->belongsTo(Location::class, 'project_id');
    }

    public function observations()
    {
        return $this->hasMany(DrawingObservation::class, 'drawing_id');
    }

    public function previousRevision()
    {
        return $this->belongsTo(self::class, 'previous_revision_id');
    }

    public function nextRevision()
    {
        return $this->hasOne(self::class, 'previous_revision_id');
    }

    public function usedTemplate()
    {
        return $this->belongsTo(TitleBlockTemplate::class, 'used_template_id');
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
        if ($this->storage_path) {
            return route('drawings.file', ['drawing' => $this->id]);
        }

        if ($this->page_preview_s3_key) {
            return route('drawings.preview', ['drawing' => $this->id]);
        }

        // Legacy fallback
        if ($this->file_path) {
            return route('drawings.file', ['drawing' => $this->id]);
        }

        return null;
    }

    public function getPdfUrlAttribute(): ?string
    {
        if ($this->storage_path && str_contains($this->mime_type ?? '', 'pdf')) {
            return route('drawings.file', ['drawing' => $this->id]);
        }

        // Legacy fallback
        if ($this->file_path && str_contains($this->file_type ?? '', 'pdf')) {
            return route('drawings.file', ['drawing' => $this->id]);
        }

        return null;
    }

    public function getDisplayNameAttribute(): string
    {
        if ($this->sheet_number && $this->title) {
            return "{$this->sheet_number} - {$this->title}";
        }

        if ($this->sheet_number) {
            return $this->sheet_number;
        }

        if ($this->drawing_number && $this->drawing_title) {
            return "{$this->drawing_number} - {$this->drawing_title}";
        }

        if ($this->drawing_number) {
            return $this->drawing_number;
        }

        if ($this->title) {
            return $this->title;
        }

        if ($this->original_name) {
            return $this->original_name;
        }

        return "Drawing #{$this->id}";
    }

    public function getThumbnailUrlAttribute(): ?string
    {
        if (! $this->thumbnail_path && ! $this->thumbnail_s3_key) {
            return null;
        }

        return route('drawings.thumbnail', ['drawing' => $this->id]);
    }

    public function getDiffImageUrlAttribute(): ?string
    {
        if (! $this->diff_image_path) {
            return null;
        }

        return route('drawings.diff', ['drawing' => $this->id]);
    }

    public function getDisplayRevisionAttribute(): string
    {
        $rev = $this->revision_number ?? '?';
        $date = $this->revision_date?->format('Y-m-d') ?? '';

        return $date ? "Rev {$rev} ({$date})" : "Rev {$rev}";
    }

    public function getPagePreviewUrlAttribute(): ?string
    {
        if (! $this->page_preview_s3_key) {
            return $this->thumbnail_url;
        }

        return route('drawings.preview', ['drawing' => $this->id]);
    }

    public function getTilesInfoAttribute(): ?array
    {
        if ($this->tiles_status !== 'completed' || ! $this->tiles_base_url) {
            return null;
        }

        // Always use the proxy route — works for both local and S3
        $baseUrl = "/drawings/{$this->id}/tiles";

        return [
            'baseUrl' => $baseUrl,
            'maxZoom' => $this->tiles_max_zoom ?? 5,
            'width' => $this->tiles_width ?? 0,
            'height' => $this->tiles_height ?? 0,
            'tileSize' => $this->tile_size ?? 256,
        ];
    }

    public function getIsPdfAttribute(): bool
    {
        if ($this->mime_type) {
            return str_contains(strtolower($this->mime_type), 'pdf');
        }

        return str_ends_with(strtolower($this->original_name ?? ''), '.pdf');
    }

    public function getIsImageAttribute(): bool
    {
        if ($this->mime_type) {
            return str_starts_with(strtolower($this->mime_type), 'image/');
        }

        return (bool) preg_match('/\.(png|jpe?g|gif|webp|bmp)$/i', $this->original_name ?? '');
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

    public function scopeExtractionQueued($query)
    {
        return $query->where('extraction_status', self::EXTRACTION_QUEUED);
    }

    public function scopeExtractionNeedsReview($query)
    {
        return $query->where('extraction_status', self::EXTRACTION_NEEDS_REVIEW);
    }

    public function scopeExtractionSuccess($query)
    {
        return $query->where('extraction_status', self::EXTRACTION_SUCCESS);
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
        // Find current active revision for this sheet
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

        return 'A' . $letters;
    }

    /**
     * Check if this drawing has tiles available for Leaflet viewer.
     */
    public function hasTiles(): bool
    {
        return $this->tiles_status === 'completed'
            && $this->tiles_base_url
            && $this->tiles_max_zoom !== null;
    }

    /**
     * Check if extraction needs review.
     */
    public function needsExtractionReview(): bool
    {
        return $this->extraction_status === self::EXTRACTION_NEEDS_REVIEW;
    }

    /**
     * Check if extraction was successful.
     */
    public function extractionSuccessful(): bool
    {
        return $this->extraction_status === self::EXTRACTION_SUCCESS;
    }

    /**
     * Calculate the size bucket from page dimensions.
     */
    public static function calculateSizeBucket(int $width, int $height): string
    {
        return TitleBlockTemplate::createSizeBucket($width, $height);
    }

    /**
     * Determine page orientation from dimensions.
     */
    public static function determineOrientation(int $width, int $height): string
    {
        return $width >= $height ? 'landscape' : 'portrait';
    }
}
