<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A single detected change within a comparison.
 *
 * Geometry (x/y/w/h) is in PDF points — the same coordinate basis as
 * DrawingMeasurement and the annotation layer — so the viewer can zoom
 * straight to a change without a second conversion.
 */
class DrawingChangeItem extends Model
{
    protected $fillable = [
        'drawing_comparison_id',
        'source',
        'change_type',
        'text_old',
        'text_new',
        'count_old',
        'count_new',
        'page_number',
        'x',
        'y',
        'w',
        'h',
        'locatable',
        'element',
        'description',
        'trade_impact',
        'significance',
        'confidence',
    ];

    protected $casts = [
        'trade_impact' => 'array',
        'page_number' => 'integer',
        'count_old' => 'integer',
        'count_new' => 'integer',
        'x' => 'float',
        'y' => 'float',
        'w' => 'float',
        'h' => 'float',
        'locatable' => 'boolean',
        'confidence' => 'float',
    ];

    const SOURCE_TEXT_LAYER = 'text_layer';

    const SOURCE_TITLE_BLOCK = 'title_block';

    /** A region whose drawn geometry changed, found by comparing rasters. */
    const SOURCE_RASTER = 'raster';

    const TYPE_ADDED = 'added';

    const TYPE_REMOVED = 'removed';

    const TYPE_MODIFIED = 'modified';

    const TYPE_MOVED = 'moved';

    public function comparison(): BelongsTo
    {
        return $this->belongsTo(DrawingComparison::class, 'drawing_comparison_id');
    }

    /**
     * Whether the viewer can zoom to this change. Requires both a position and
     * confidence that the position is a real page coordinate.
     */
    public function hasLocation(): bool
    {
        return $this->x !== null && $this->y !== null && $this->locatable;
    }
}
