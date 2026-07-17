<?php

namespace App\Models;

use App\Models\Concerns\HasChecklists;
use App\Models\Concerns\HasComments;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * Field task pinned on a plan. NOT the scheduler task (see ProjectTask).
 *
 * A top-level task is the pin anchor ("Unit 1203"); its children are
 * rectifications (raised from QA checklist items) and work-tracker phase
 * tasks. Classification is data (SiteTaskCategory); structure derives from
 * parent_id / checklist_item_id. Nesting is one level deep only.
 */
class SiteTask extends Model
{
    use HasChecklists, HasComments, SoftDeletes;

    public const STATUSES = ['open', 'in_progress', 'completed', 'closed', 'cancelled'];

    /** Work-tracker phases stamped onto a unit by importWorkTrackerPhases(). */
    public const WORK_TRACKER_PHASES = [
        'Frame firewall',
        'Sheet firewall',
        'Close firewall',
        'Sheet unit',
        'Frame unit',
        'Set and sand',
    ];

    protected $fillable = [
        'watermelon_id',
        'location_id',
        'parent_id',
        'category_id',
        'title',
        'description',
        'drawing_id',
        'page_number',
        'x',
        'y',
        'checklist_item_id',
        'status',
        'due_date',
        'sort_order',
        'completed_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'x' => 'float',
        'y' => 'float',
        'page_number' => 'integer',
        'sort_order' => 'integer',
        'due_date' => 'date:Y-m-d',
        'completed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $task) {
            $task->watermelon_id ??= (string) Str::uuid();
            $task->created_by ??= auth()->id();
            $task->updated_by ??= auth()->id();
        });

        static::updating(function (self $task) {
            $task->updated_by = auth()->id() ?? $task->updated_by;
        });
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('sort_order')->orderBy('id');
    }

    public function drawing(): BelongsTo
    {
        return $this->belongsTo(Drawing::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(SiteTaskCategory::class, 'category_id');
    }

    public function checklistItem(): BelongsTo
    {
        return $this->belongsTo(ChecklistItem::class);
    }

    public function assignees(): HasMany
    {
        return $this->hasMany(SiteTaskAssignee::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Pin to render for this task: its own, or its parent's. */
    public function effectivePin(): ?array
    {
        $source = $this->drawing_id !== null ? $this : $this->parent;

        if (! $source || $source->drawing_id === null || $source->x === null || $source->y === null) {
            return null;
        }

        return [
            'drawing_id' => $source->drawing_id,
            'page_number' => $source->page_number ?? 1,
            'x' => $source->x,
            'y' => $source->y,
        ];
    }

    /**
     * Assign an employee. Restores a previously-removed assignment so the
     * unique (site_task_id, employee_id) constraint holds across soft deletes.
     */
    public function assignEmployee(int $employeeId): SiteTaskAssignee
    {
        $assignee = SiteTaskAssignee::withTrashed()
            ->where('site_task_id', $this->id)
            ->where('employee_id', $employeeId)
            ->first();

        if ($assignee) {
            if ($assignee->trashed()) {
                $assignee->restore();
            }

            return $assignee;
        }

        return $this->assignees()->create(['employee_id' => $employeeId]);
    }

    /**
     * Stamp the standard work-tracker phases onto this unit as child tasks
     * (Works Tracker category). Idempotent: existing titles are skipped.
     */
    public function importWorkTrackerPhases(): int
    {
        $categoryId = SiteTaskCategory::where('code', 'WT')->value('id');

        $existing = $this->children()->pluck('title')->all();

        $created = 0;
        foreach (self::WORK_TRACKER_PHASES as $i => $phase) {
            if (in_array($phase, $existing, true)) {
                continue;
            }

            $this->children()->create([
                'location_id' => $this->location_id,
                'category_id' => $categoryId,
                'title' => $phase,
                'sort_order' => $i,
                'status' => 'open',
            ]);
            $created++;
        }

        return $created;
    }
}
