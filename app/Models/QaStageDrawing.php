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
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'revision_date' => 'date',
        'ai_extracted_metadata' => 'array',
        'page_dimensions' => 'array',
        'page_number' => 'integer',
    ];

    protected $appends = ['file_url', 'thumbnail_url', 'diff_image_url', 'display_name', 'total_pages'];

    const STATUS_DRAFT = 'draft';
    const STATUS_PROCESSING = 'processing';
    const STATUS_PENDING_REVIEW = 'pending_review';
    const STATUS_ACTIVE = 'active';
    const STATUS_SUPERSEDED = 'superseded';
    const STATUS_ARCHIVED = 'archived';

    protected static function booted()
    {
        static::creating(function ($model) {
            $model->created_by = auth()->id();
            if (!$model->status) {
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
            return $this->drawingFile->file_url;
        }

        // Fallback to legacy file_path
        if (!$this->file_path) {
            return null;
        }
        return '/storage/' . $this->file_path;
    }

    /**
     * Get a display name that includes page number for multi-page files.
     */
    public function getDisplayNameAttribute(): string
    {
        $totalPages = $this->total_pages;
        if ($totalPages > 1) {
            return $this->page_label ?? "{$this->name} — Page {$this->page_number}";
        }
        return $this->page_label ?? $this->name;
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
        if (!$this->thumbnail_path) {
            return null;
        }
        // Use relative URL to avoid CORS issues when APP_URL doesn't match current host
        return '/storage/' . $this->thumbnail_path;
    }

    public function getDiffImageUrlAttribute()
    {
        if (!$this->diff_image_path) {
            return null;
        }
        // Use relative URL to avoid CORS issues when APP_URL doesn't match current host
        return '/storage/' . $this->diff_image_path;
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
        if (!$this->drawing_sheet_id) {
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
}
