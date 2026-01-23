<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * DrawingSet represents a multi-page PDF upload that is processed for metadata extraction.
 *
 * Each page of the PDF becomes a QaStageDrawing (drawing sheet) with extracted metadata.
 *
 * @property int $id
 * @property int $project_id
 * @property string $original_pdf_s3_key
 * @property int $page_count
 * @property string $status
 * @property string|null $original_filename
 * @property int|null $file_size
 * @property string|null $sha256
 * @property array|null $processing_errors
 * @property int $created_by
 * @property int|null $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * @property \Carbon\Carbon|null $deleted_at
 */
class DrawingSet extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'drawing_sets';

    const STATUS_QUEUED = 'queued';
    const STATUS_PROCESSING = 'processing';
    const STATUS_PARTIAL = 'partial';
    const STATUS_SUCCESS = 'success';
    const STATUS_FAILED = 'failed';

    protected $fillable = [
        'project_id',
        'original_pdf_s3_key',
        'page_count',
        'status',
        'original_filename',
        'file_size',
        'sha256',
        'processing_errors',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'page_count' => 'integer',
        'file_size' => 'integer',
        'processing_errors' => 'array',
    ];

    protected static function booted()
    {
        static::creating(function ($model) {
            $model->created_by = $model->created_by ?? auth()->id();
        });

        static::updating(function ($model) {
            $model->updated_by = auth()->id();
        });
    }

    // Relationships

    /**
     * The project (location) this drawing set belongs to.
     */
    public function project()
    {
        return $this->belongsTo(Location::class, 'project_id');
    }

    /**
     * All drawing sheets (pages) in this set.
     */
    public function sheets()
    {
        return $this->hasMany(QaStageDrawing::class, 'drawing_set_id')
            ->orderBy('page_number');
    }

    /**
     * The first sheet (page 1) for thumbnail preview.
     */
    public function firstSheet()
    {
        return $this->hasOne(QaStageDrawing::class, 'drawing_set_id')
            ->where('page_number', 1);
    }

    /**
     * Sheets that need review.
     */
    public function sheetsNeedingReview()
    {
        return $this->hasMany(QaStageDrawing::class, 'drawing_set_id')
            ->where('extraction_status', 'needs_review')
            ->orderBy('page_number');
    }

    /**
     * Successfully extracted sheets.
     */
    public function successfulSheets()
    {
        return $this->hasMany(QaStageDrawing::class, 'drawing_set_id')
            ->where('extraction_status', 'success')
            ->orderBy('page_number');
    }

    /**
     * The user who uploaded this set.
     */
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * The user who last updated this set.
     */
    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    // Accessors

    /**
     * Get extraction progress as a percentage.
     */
    public function getExtractionProgressAttribute(): int
    {
        if ($this->page_count === 0) {
            return 0;
        }

        $processed = $this->sheets()
            ->whereIn('extraction_status', ['success', 'needs_review', 'failed'])
            ->count();

        return (int) round(($processed / $this->page_count) * 100);
    }

    /**
     * Get counts by extraction status.
     */
    public function getExtractionStatsAttribute(): array
    {
        $stats = $this->hasMany(QaStageDrawing::class, 'drawing_set_id')
            ->selectRaw('extraction_status, COUNT(*) as count')
            ->groupBy('extraction_status')
            ->pluck('count', 'extraction_status')
            ->toArray();

        return [
            'total' => $this->page_count,
            'queued' => $stats['queued'] ?? 0,
            'processing' => $stats['processing'] ?? 0,
            'success' => $stats['success'] ?? 0,
            'needs_review' => $stats['needs_review'] ?? 0,
            'failed' => $stats['failed'] ?? 0,
        ];
    }

    // Methods

    /**
     * Update the set status based on sheet extraction statuses.
     */
    public function updateStatusFromSheets(): void
    {
        $stats = $this->extraction_stats;

        if ($stats['failed'] === $stats['total']) {
            $this->status = self::STATUS_FAILED;
        } elseif ($stats['success'] === $stats['total']) {
            $this->status = self::STATUS_SUCCESS;
        } elseif ($stats['queued'] > 0 || $stats['processing'] > 0) {
            $this->status = self::STATUS_PROCESSING;
        } elseif ($stats['needs_review'] > 0 || $stats['failed'] > 0) {
            $this->status = self::STATUS_PARTIAL;
        } else {
            $this->status = self::STATUS_SUCCESS;
        }

        $this->save();
    }

    /**
     * Check if all sheets have been processed (success, needs_review, or failed).
     */
    public function isFullyProcessed(): bool
    {
        return !$this->sheets()
            ->whereIn('extraction_status', ['queued', 'processing'])
            ->exists();
    }
}
