<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class ChecklistItem extends Model
{
    use LogsActivity;

    /** QA outcome statuses. Null = not yet inspected. */
    public const STATUS_OK = 'ok';

    public const STATUS_PROBLEM = 'problem';

    public const STATUS_NA = 'na';

    public const STATUSES = [self::STATUS_OK, self::STATUS_PROBLEM, self::STATUS_NA];

    protected $fillable = [
        'watermelon_id',
        'checklist_id',
        'label',
        'sort_order',
        'is_required',
        'status',
        'completed_at',
        'completed_by',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'completed_at' => 'datetime',
        ];
    }

    public function checklist(): BelongsTo
    {
        return $this->belongsTo(Checklist::class);
    }

    public function completedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }

    /** Rectification tasks raised from this QA item. */
    public function rectificationTasks(): HasMany
    {
        return $this->hasMany(SiteTask::class, 'checklist_item_id');
    }

    public function isCompleted(): bool
    {
        return $this->completed_at !== null;
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['completed_at', 'completed_by', 'notes', 'label', 'status'])
            ->logOnlyDirty()
            ->useLogName('checklist');
    }
}
