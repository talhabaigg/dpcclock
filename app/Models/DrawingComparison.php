<?php

namespace App\Models;

use App\Services\Drawings\DrawingRegionCropper;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

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
        'progress_stage',
        'progress_done',
        'progress_total',
        'started_at',
        'heartbeat_at',
        'error',
        'methods',
        'pipeline_version',
        'text_comparable',
        'page_width',
        'page_height',
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
        'revision_notes' => 'array',
        'changes_total' => 'integer',
        'changes_high' => 'integer',
        'input_tokens' => 'integer',
        'output_tokens' => 'integer',
        'analyzed_at' => 'datetime',
        'started_at' => 'datetime',
        'heartbeat_at' => 'datetime',
        'progress_done' => 'integer',
        'progress_total' => 'integer',
    ];

    const STATUS_PENDING = 'pending';

    const STATUS_RUNNING = 'running';

    const STATUS_COMPLETE = 'complete';

    const STATUS_FAILED = 'failed';

    protected static function booted(): void
    {
        // Previews are files, not rows. Deleting the comparison has to take
        // them with it or they accumulate silently — a run of forty regions is
        // several megabytes, and nothing else ever looks at that directory.
        //
        // Note this covers deletes that go through Eloquent. A drawing removed
        // at the database level cascades to this table without firing model
        // events, so `drawings:prune-change-previews` exists to sweep those up.
        static::deleting(function (self $comparison) {
            Storage::disk(DrawingRegionCropper::DISK)
                ->deleteDirectory("drawing-change-previews/{$comparison->id}");
        });
    }

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

    /**
     * Seconds since the job last reported progress. Null when it has never
     * reported, which is itself a signal on a row that claims to be running.
     */
    public function secondsSinceHeartbeat(): ?int
    {
        return $this->heartbeat_at?->diffInSeconds(now());
    }

    /**
     * A run that claims to be going but has not checked in for a while.
     *
     * Worth surfacing rather than hiding: the job timeout is enforced by a
     * pcntl alarm, which does not exist on Windows, so a wedged job can sit in
     * "running" indefinitely with nothing to clear it.
     */
    public function looksStalled(int $threshold = 300): bool
    {
        if ($this->status !== self::STATUS_RUNNING) {
            return false;
        }

        $since = $this->secondsSinceHeartbeat();

        return $since === null || $since > $threshold;
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, [self::STATUS_COMPLETE, self::STATUS_FAILED], true);
    }
}
