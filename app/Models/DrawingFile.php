<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * DrawingFile represents a single uploaded file (PDF or image).
 *
 * Multi-page PDFs are stored as one file record, with individual pages
 * represented as separate QaStageDrawing records referencing this file.
 *
 * @property int $id
 * @property int $qa_stage_id
 * @property string $storage_path
 * @property string $original_name
 * @property string|null $mime_type
 * @property int|null $file_size
 * @property string|null $sha256
 * @property int $page_count
 * @property int $created_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * @property \Carbon\Carbon|null $deleted_at
 */
class DrawingFile extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'drawing_files';

    protected $fillable = [
        'qa_stage_id',
        'storage_path',
        'original_name',
        'mime_type',
        'file_size',
        'sha256',
        'page_count',
        'created_by',
    ];

    protected $casts = [
        'page_count' => 'integer',
        'file_size' => 'integer',
    ];

    protected $appends = ['file_url'];

    // Relationships

    /**
     * The QA stage this file belongs to.
     */
    public function qaStage()
    {
        return $this->belongsTo(QaStage::class);
    }

    /**
     * All drawing pages for this file.
     */
    public function drawings()
    {
        return $this->hasMany(QaStageDrawing::class, 'drawing_file_id')
            ->orderBy('page_number');
    }

    /**
     * The user who uploaded this file.
     */
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // Accessors

    /**
     * Get the URL for accessing this file.
     */
    public function getFileUrlAttribute(): ?string
    {
        if (!$this->storage_path) {
            return null;
        }
        // Use relative URL to avoid CORS issues
        return '/storage/' . $this->storage_path;
    }

    /**
     * Check if this is a PDF file.
     */
    public function getIsPdfAttribute(): bool
    {
        if ($this->mime_type) {
            return str_contains(strtolower($this->mime_type), 'pdf');
        }
        return str_ends_with(strtolower($this->original_name ?? ''), '.pdf');
    }

    /**
     * Check if this is an image file.
     */
    public function getIsImageAttribute(): bool
    {
        if ($this->mime_type) {
            return str_starts_with(strtolower($this->mime_type), 'image/');
        }
        return (bool) preg_match('/\.(png|jpe?g|gif|webp|bmp)$/i', $this->original_name ?? '');
    }

    // Methods

    /**
     * Get a specific page's drawing record.
     */
    public function getPage(int $pageNumber): ?QaStageDrawing
    {
        return $this->drawings()->where('page_number', $pageNumber)->first();
    }

    /**
     * Check if a specific page exists.
     */
    public function hasPage(int $pageNumber): bool
    {
        return $pageNumber >= 1 && $pageNumber <= $this->page_count;
    }
}
