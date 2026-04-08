<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class ToolboxTalk extends Model implements HasMedia
{
    use HasUuids, InteractsWithMedia, LogsActivity, SoftDeletes;

    protected $fillable = [
        'location_id',
        'meeting_date',
        'called_by',
        'meeting_subject',
        'key_topics',
        'action_points',
        'injuries',
        'near_misses',
        'floor_comments',
        'created_by',
        'locked_at',
    ];

    protected $casts = [
        'key_topics' => 'array',
        'action_points' => 'array',
        'injuries' => 'array',
        'near_misses' => 'array',
        'floor_comments' => 'array',
        'locked_at' => 'datetime',
    ];

    protected $appends = ['meeting_date_formatted', 'is_locked'];

    public const SUBJECT_OPTIONS = [
        'health_and_safety' => 'Health and Safety',
        'environmental_issue' => 'Environmental Issue',
        'quality_issue' => 'Quality Issue',
    ];

    public const GENERAL_ITEMS = [
        'All workers MUST attend the daily prestart meeting and sign in prior to commencing work.',
        'All workers MUST wear Mandatory PPE as identified in the site-specific induction and as specified in all SWC SWMS.',
        'All Incidents / Accidents MUST be reported immediately to your HSR or Foreman regardless of the severity or nature of the incident / accident.',
        'Workers MUST be fit for work, any pre-existing injuries / illnesses or conditions that may impact your ability to undertake work safely must be reported to your HSR or Foreman immediately.',
        'If you see anything that is deemed to be unsafe or something has the potential to cause harm, report it immediately to your HSR or Foreman.',
        'Housekeeping MUST be undertaken daily and as required throughout each task. All workers have a responsibility to maintain a safe and clean work environment.',
    ];

    // --- Activity log ---

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnlyDirty()
            ->logFillable()
            ->useLogName('toolbox_talk');
    }

    // --- Accessors ---

    public function getIsLockedAttribute(): bool
    {
        if ($this->locked_at) {
            return true;
        }

        if (! $this->meeting_date) {
            return false;
        }

        return \Carbon\Carbon::parse($this->meeting_date)->lt(now('Australia/Brisbane')->startOfDay());
    }

    public function getMeetingDateFormattedAttribute(): ?string
    {
        if (! $this->meeting_date) {
            return null;
        }

        return \Carbon\Carbon::parse($this->meeting_date)->format('D d/m/Y');
    }

    // --- Media collections ---

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('topic_files');
        $this->addMediaCollection('action_point_files');
        $this->addMediaCollection('injury_files');
        $this->addMediaCollection('near_miss_files');
        $this->addMediaCollection('floor_comment_files');
        $this->addMediaCollection('signed_pdf');
    }

    // --- Relationships ---

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function calledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'called_by');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function attendees(): HasMany
    {
        return $this->hasMany(ToolboxTalkAttendee::class);
    }
}
