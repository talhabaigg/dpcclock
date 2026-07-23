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
        'page_number',
        'x',
        'y',
        'w',
        'h',
        'element',
        'description',
        'trade_impact',
        'significance',
        'confidence',
    ];

    protected $casts = [
        'trade_impact' => 'array',
        'page_number' => 'integer',
        'x' => 'float',
        'y' => 'float',
        'w' => 'float',
        'h' => 'float',
        'confidence' => 'float',
    ];

    const SOURCE_TEXT_LAYER = 'text_layer';

    const SOURCE_TITLE_BLOCK = 'title_block';

    const TYPE_ADDED = 'added';

    const TYPE_REMOVED = 'removed';

    const TYPE_MODIFIED = 'modified';

    const TYPE_MOVED = 'moved';

    public function comparison(): BelongsTo
    {
        return $this->belongsTo(DrawingComparison::class, 'drawing_comparison_id');
    }

    /**
     * Whether this change can be located on the plan. Title-block rows and any
     * item whose geometry was dropped are list-only.
     */
    public function hasLocation(): bool
    {
        return $this->x !== null && $this->y !== null;
    }
}
