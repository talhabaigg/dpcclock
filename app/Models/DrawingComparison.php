<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One analysis run over an ordered pair of drawing revisions.
 *
 * The pair is immutable once both revisions exist, so a `complete` row is a
 * permanent cache — re-opening the same comparison never re-bills the AI call.
 */
class DrawingComparison extends Model
{
    protected $fillable = [
        'old_drawing_id',
        'new_drawing_id',
        'status',
        'error',
        'methods',
        'pipeline_version',
        'text_comparable',
        'page_width',
        'page_height',
        'coordinates_reliable',
        'summary',
        'revision_notes',
        'changes_total',
        'changes_high',
        'model',
        'input_tokens',
        'output_tokens',
        'analyzed_at',
        'created_by',
    ];

    protected $casts = [
        'methods' => 'array',
        'pipeline_version' => 'integer',
        'text_comparable' => 'boolean',
        'page_width' => 'float',
        'page_height' => 'float',
        'coordinates_reliable' => 'boolean',
        'revision_notes' => 'array',
        'changes_total' => 'integer',
        'changes_high' => 'integer',
        'input_tokens' => 'integer',
        'output_tokens' => 'integer',
        'analyzed_at' => 'datetime',
    ];

    const STATUS_PENDING = 'pending';

    const STATUS_RUNNING = 'running';

    const STATUS_COMPLETE = 'complete';

    const STATUS_FAILED = 'failed';

    public function oldDrawing(): BelongsTo
    {
        return $this->belongsTo(Drawing::class, 'old_drawing_id');
    }

    public function newDrawing(): BelongsTo
    {
        return $this->belongsTo(Drawing::class, 'new_drawing_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(DrawingChangeItem::class);
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, [self::STATUS_COMPLETE, self::STATUS_FAILED], true);
    }
}
