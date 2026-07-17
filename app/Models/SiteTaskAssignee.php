<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * One employee on one site task, with their own completion record —
 * a work-tracker phase done by two workers has two rows, each stamped
 * when that person finished.
 */
class SiteTaskAssignee extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'watermelon_id',
        'site_task_id',
        'employee_id',
        'completed_at',
        'marked_by',
    ];

    protected $casts = [
        'completed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $assignee) {
            $assignee->watermelon_id ??= (string) Str::uuid();
        });
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(SiteTask::class, 'site_task_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function markedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'marked_by');
    }
}
