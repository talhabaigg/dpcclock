<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * TitleBlockTemplate stores reusable crop regions for extracting metadata from drawing sheets.
 *
 * Templates are learned from user-drawn capture boxes and matched to sheets
 * based on orientation and size bucket.
 *
 * @property int $id
 * @property int $project_id
 * @property string $name
 * @property array $crop_rect {x, y, w, h} normalized 0..1
 * @property string|null $orientation
 * @property string|null $size_bucket
 * @property array|null $anchor_labels
 * @property int $success_count
 * @property \Carbon\Carbon|null $last_used_at
 * @property int $created_by
 * @property int|null $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * @property \Carbon\Carbon|null $deleted_at
 */
class TitleBlockTemplate extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'title_block_templates';

    protected $fillable = [
        'project_id',
        'name',
        'crop_rect',
        'orientation',
        'size_bucket',
        'anchor_labels',
        'success_count',
        'last_used_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'crop_rect' => 'array',
        'anchor_labels' => 'array',
        'success_count' => 'integer',
        'last_used_at' => 'datetime',
    ];

    /**
     * The attributes that should be hidden from serialization and not persisted.
     * match_score is a computed property used during template matching.
     */
    protected $guarded = ['match_score'];

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
     * The project (location) this template belongs to.
     */
    public function project()
    {
        return $this->belongsTo(Location::class, 'project_id');
    }

    /**
     * Sheets that used this template successfully.
     */
    public function usedBySheets()
    {
        return $this->hasMany(QaStageDrawing::class, 'used_template_id');
    }

    /**
     * The user who created this template.
     */
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * The user who last updated this template.
     */
    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    // Accessors

    /**
     * Get the crop rectangle as pixel coordinates for a given image size.
     */
    public function getCropPixels(int $imageWidth, int $imageHeight): array
    {
        $rect = $this->crop_rect;

        return [
            'x' => (int) round($rect['x'] * $imageWidth),
            'y' => (int) round($rect['y'] * $imageHeight),
            'w' => (int) round($rect['w'] * $imageWidth),
            'h' => (int) round($rect['h'] * $imageHeight),
        ];
    }

    // Methods

    /**
     * Record a successful use of this template.
     */
    public function recordSuccess(): void
    {
        // Unset computed match_score before saving to prevent SQL error
        unset($this->match_score);

        $this->increment('success_count');
        $this->update(['last_used_at' => now()]);
    }

    /**
     * Calculate match score for a given sheet based on orientation and size.
     *
     * @param string|null $orientation 'portrait' or 'landscape'
     * @param string|null $sizeBucket e.g., "7016x4961"
     * @return int Score (higher is better match)
     */
    public function calculateMatchScore(?string $orientation, ?string $sizeBucket): int
    {
        $score = 0;

        // Orientation match is most important
        if ($this->orientation === null || $this->orientation === $orientation) {
            $score += 100;
        } else {
            // Wrong orientation is a strong negative signal
            return 0;
        }

        // Size bucket match
        if ($this->size_bucket === null) {
            // Template works for any size
            $score += 50;
        } elseif ($this->size_bucket === $sizeBucket) {
            // Exact match
            $score += 80;
        } elseif ($sizeBucket !== null) {
            // Parse and compare dimensions
            $templateDims = $this->parseSizeBucket($this->size_bucket);
            $sheetDims = $this->parseSizeBucket($sizeBucket);

            if ($templateDims && $sheetDims) {
                // Calculate dimension similarity (within 10% is good)
                $widthRatio = min($templateDims['w'], $sheetDims['w']) /
                              max($templateDims['w'], $sheetDims['w']);
                $heightRatio = min($templateDims['h'], $sheetDims['h']) /
                               max($templateDims['h'], $sheetDims['h']);

                if ($widthRatio > 0.9 && $heightRatio > 0.9) {
                    $score += 60;
                } elseif ($widthRatio > 0.8 && $heightRatio > 0.8) {
                    $score += 30;
                }
            }
        }

        // Bonus for successful track record
        $score += min(20, $this->success_count);

        return $score;
    }

    /**
     * Parse a size bucket string into width and height.
     */
    private function parseSizeBucket(?string $bucket): ?array
    {
        if (!$bucket) {
            return null;
        }

        if (preg_match('/^(\d+)x(\d+)$/', $bucket, $matches)) {
            return [
                'w' => (int) $matches[1],
                'h' => (int) $matches[2],
            ];
        }

        return null;
    }

    /**
     * Find best matching templates for a given project and sheet characteristics.
     *
     * @param int $projectId
     * @param string|null $orientation
     * @param string|null $sizeBucket
     * @param int $limit
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public static function findBestMatches(
        int $projectId,
        ?string $orientation,
        ?string $sizeBucket,
        int $limit = 2
    ): \Illuminate\Database\Eloquent\Collection {
        $templates = self::where('project_id', $projectId)
            ->where(function ($query) use ($orientation) {
                $query->whereNull('orientation')
                    ->orWhere('orientation', $orientation);
            })
            ->get();

        // Score and sort templates
        $scored = $templates->map(function ($template) use ($orientation, $sizeBucket) {
            $template->match_score = $template->calculateMatchScore($orientation, $sizeBucket);
            return $template;
        })->filter(function ($template) {
            return $template->match_score > 0;
        })->sortByDesc('match_score');

        return $scored->take($limit)->values();
    }

    /**
     * Create a size bucket string from pixel dimensions.
     * Rounds to nearest 50px to reduce noise.
     */
    public static function createSizeBucket(int $width, int $height): string
    {
        $roundedWidth = (int) round($width / 50) * 50;
        $roundedHeight = (int) round($height / 50) * 50;

        return "{$roundedWidth}x{$roundedHeight}";
    }
}
