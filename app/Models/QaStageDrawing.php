<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class QaStageDrawing extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'qa_stage_id',
        'drawing_sheet_id',
        'drawing_file_id',
        'drawing_set_id',
        'page_number',
        'page_label',
        'name',
        'revision_number',
        'revision_date',
        'revision_notes',
        'status',
        // Legacy file fields - kept for backwards compatibility during migration
        // TODO: Remove these after full migration to drawing_files
        'file_path',
        'file_name',
        'file_type',
        'file_size',
        'thumbnail_path',
        'ai_extracted_metadata',
        'page_dimensions',
        'diff_image_path',
        'previous_revision_id',
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
        'page_number' => 'integer',
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
    ];

    protected $appends = ['file_url', 'thumbnail_url', 'diff_image_url', 'display_name', 'total_pages', 'pdf_url', 'is_drawing_set_sheet', 'tiles_info'];

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
            $model->created_by = auth()->id();
            if (! $model->status) {
                $model->status = self::STATUS_DRAFT;
            }
        });

        static::updating(function ($model) {
            $model->updated_by = auth()->id();
        });
    }

    // Relationships

    public function qaStage()
    {
        return $this->belongsTo(QaStage::class);
    }

    public function drawingSheet()
    {
        return $this->belongsTo(DrawingSheet::class);
    }

    /**
     * The file this drawing page belongs to.
     */
    public function drawingFile()
    {
        return $this->belongsTo(DrawingFile::class, 'drawing_file_id');
    }

    /**
     * The drawing set (PDF upload) this sheet belongs to.
     */
    public function drawingSet()
    {
        return $this->belongsTo(DrawingSet::class, 'drawing_set_id');
    }

    /**
     * The title block template used for successful extraction.
     */
    public function usedTemplate()
    {
        return $this->belongsTo(TitleBlockTemplate::class, 'used_template_id');
    }

    public function observations()
    {
        return $this->hasMany(QaStageDrawingObservation::class, 'qa_stage_drawing_id');
    }

    public function previousRevision()
    {
        return $this->belongsTo(QaStageDrawing::class, 'previous_revision_id');
    }

    public function nextRevision()
    {
        return $this->hasOne(QaStageDrawing::class, 'previous_revision_id');
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

    /**
     * Get the file URL - prefers DrawingFile, falls back to legacy file_path.
     */
    public function getFileUrlAttribute(): ?string
    {
        // Prefer the new DrawingFile relationship
        if ($this->drawing_file_id && $this->drawingFile) {
            return route('qa-stage-drawings.file', ['drawing' => $this->id]);
        }

        // For drawing set sheets, use the S3 page preview
        if ($this->drawing_set_id && $this->page_preview_s3_key) {
            return route('drawing-sheets.preview', ['sheet' => $this->id]);
        }

        // Fallback to legacy file_path — use streaming endpoint
        if (! $this->file_path) {
            return null;
        }

        return route('qa-stage-drawings.file', ['drawing' => $this->id]);
    }

    /**
     * Get the PDF URL for this drawing.
     * For drawing sets, returns the streaming endpoint that proxies from S3.
     * For other drawings, returns the file_url if it's a PDF.
     */
    public function getPdfUrlAttribute(): ?string
    {
        // For drawing set sheets, return the streaming PDF endpoint (avoids CORS issues)
        if ($this->drawing_set_id && $this->drawingSet) {
            return route('drawing-sets.pdf', ['drawingSet' => $this->drawing_set_id]);
        }

        // For DrawingFile-based drawings, check if it's a PDF
        if ($this->drawing_file_id && $this->drawingFile) {
            if (str_contains($this->drawingFile->mime_type ?? '', 'pdf')) {
                return route('qa-stage-drawings.file', ['drawing' => $this->id]);
            }

            return null;
        }

        // For legacy file_path, check if it's a PDF — use streaming endpoint
        if ($this->file_path && str_contains($this->file_type ?? '', 'pdf')) {
            return route('qa-stage-drawings.file', ['drawing' => $this->id]);
        }

        return null;
    }

    /**
     * Check if this drawing is from a drawing set (needs special PDF URL handling).
     */
    public function getIsDrawingSetSheetAttribute(): bool
    {
        return $this->drawing_set_id !== null;
    }

    /**
     * Get a display name that includes page number for multi-page files.
     */
    public function getDisplayNameAttribute(): string
    {
        // Use page_label if set
        if ($this->page_label) {
            return $this->page_label;
        }

        // For drawing set sheets, use drawing number + title if available
        if ($this->drawing_set_id) {
            $parts = [];
            if ($this->drawing_number) {
                $parts[] = $this->drawing_number;
            }
            if ($this->drawing_title) {
                $parts[] = $this->drawing_title;
            }
            if (! empty($parts)) {
                return implode(' - ', $parts);
            }

            // Fallback to page number
            return 'Page '.($this->page_number ?? '?');
        }

        // Legacy: use name with page number
        $totalPages = $this->total_pages;
        $baseName = $this->name ?? 'Drawing';
        if ($totalPages > 1) {
            return "{$baseName} — Page {$this->page_number}";
        }

        return $baseName;
    }

    /**
     * Get total pages in the source file.
     */
    public function getTotalPagesAttribute(): int
    {
        // Prefer DrawingFile page_count
        if ($this->drawing_file_id && $this->drawingFile) {
            return $this->drawingFile->page_count;
        }

        // Fallback to page_dimensions
        if ($this->page_dimensions && isset($this->page_dimensions['pages'])) {
            return max(1, (int) $this->page_dimensions['pages']);
        }

        return 1;
    }

    public function getThumbnailUrlAttribute()
    {
        if (! $this->thumbnail_path && ! $this->thumbnail_s3_key) {
            return null;
        }

        return route('qa-stage-drawings.thumbnail', ['drawing' => $this->id]);
    }

    public function getDiffImageUrlAttribute()
    {
        if (! $this->diff_image_path) {
            return null;
        }

        return '/storage/'.$this->diff_image_path;
    }

    public function getDisplayRevisionAttribute(): string
    {
        $rev = $this->revision_number ?? '?';
        $date = $this->revision_date?->format('Y-m-d') ?? '';

        return $date ? "Rev {$rev} ({$date})" : "Rev {$rev}";
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

    /**
     * Check if this is the current/active revision
     */
    public function isCurrentRevision(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /**
     * Check if this revision has been superseded
     */
    public function isSuperseded(): bool
    {
        return $this->status === self::STATUS_SUPERSEDED;
    }

    /**
     * Get all revisions of the same sheet
     */
    public function getSiblingRevisions()
    {
        if (! $this->drawing_sheet_id) {
            return collect([$this]);
        }

        return self::where('drawing_sheet_id', $this->drawing_sheet_id)
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Mark this revision as active and supersede others
     */
    public function makeActive(): void
    {
        if ($this->drawing_sheet_id) {
            // Supersede all other revisions of this sheet
            self::where('drawing_sheet_id', $this->drawing_sheet_id)
                ->where('id', '!=', $this->id)
                ->where('status', self::STATUS_ACTIVE)
                ->update(['status' => self::STATUS_SUPERSEDED]);

            // Update the sheet's current revision
            DrawingSheet::where('id', $this->drawing_sheet_id)
                ->update(['current_revision_id' => $this->id]);
        }

        $this->status = self::STATUS_ACTIVE;
        $this->save();
    }

    /**
     * Get the page preview URL from S3 key.
     */
    public function getPagePreviewUrlAttribute(): ?string
    {
        if (! $this->page_preview_s3_key) {
            return $this->thumbnail_url;
        }

        // Page previews are on S3 — use the sheet preview streaming endpoint
        return route('drawing-sheets.preview', ['sheet' => $this->id]);
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

    /**
     * Get tile information for Leaflet viewer.
     * Returns null if tiles are not available.
     */
    public function getTilesInfoAttribute(): ?array
    {
        if ($this->tiles_status !== 'completed' || !$this->tiles_base_url) {
            return null;
        }

        // Get the S3 URL for the tiles base path
        $baseUrl = Storage::disk('s3')->url($this->tiles_base_url);

        return [
            'baseUrl' => $baseUrl,
            'maxZoom' => $this->tiles_max_zoom ?? 5,
            'width' => $this->tiles_width ?? 0,
            'height' => $this->tiles_height ?? 0,
            'tileSize' => $this->tile_size ?? 256,
        ];
    }

    /**
     * Check if tiles are available for this drawing.
     */
    public function hasTiles(): bool
    {
        return $this->tiles_status === 'completed'
            && $this->tiles_base_url
            && $this->tiles_max_zoom !== null;
    }
}
