<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DrawingAlignment extends Model
{
    protected $fillable = [
        'base_drawing_id',
        'candidate_drawing_id',
        'created_by',
        'scale',
        'rotation',
        'translate_x',
        'translate_y',
        'css_transform',
        'method',
        'alignment_points',
    ];

    protected $casts = [
        'scale' => 'float',
        'rotation' => 'float',
        'translate_x' => 'float',
        'translate_y' => 'float',
        'alignment_points' => 'array',
    ];

    public function baseDrawing(): BelongsTo
    {
        return $this->belongsTo(Drawing::class, 'base_drawing_id');
    }

    public function candidateDrawing(): BelongsTo
    {
        return $this->belongsTo(Drawing::class, 'candidate_drawing_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Find alignment for a specific drawing pair.
     */
    public static function findForPair(int $baseDrawingId, int $candidateDrawingId): ?self
    {
        return self::where('base_drawing_id', $baseDrawingId)
            ->where('candidate_drawing_id', $candidateDrawingId)
            ->first();
    }

    /**
     * Save or update alignment for a drawing pair.
     */
    public static function saveAlignment(
        int $baseDrawingId,
        int $candidateDrawingId,
        array $transform,
        string $method = 'manual',
        ?array $alignmentPoints = null
    ): self {
        return self::updateOrCreate(
            [
                'base_drawing_id' => $baseDrawingId,
                'candidate_drawing_id' => $candidateDrawingId,
            ],
            [
                'scale' => $transform['scale'] ?? 1,
                'rotation' => $transform['rotation'] ?? 0,
                'translate_x' => $transform['translateX'] ?? 0,
                'translate_y' => $transform['translateY'] ?? 0,
                'css_transform' => $transform['cssTransform'] ?? null,
                'method' => $method,
                'alignment_points' => $alignmentPoints,
                'created_by' => auth()->id(),
            ]
        );
    }

    /**
     * Convert to frontend transform format.
     */
    public function toTransform(): array
    {
        return [
            'scale' => $this->scale,
            'rotation' => $this->rotation,
            'translateX' => $this->translate_x,
            'translateY' => $this->translate_y,
            'cssTransform' => $this->css_transform,
            'method' => $this->method,
        ];
    }
}
