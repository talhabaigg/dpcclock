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

class DailyPrestart extends Model implements HasMedia
{
    use HasUuids, InteractsWithMedia, LogsActivity, SoftDeletes;

    protected $fillable = [
        'location_id',
        'work_date',
        'foreman_id',
        'weather',
        'weather_impact',
        'activities',
        'safety_concerns',
        'is_active',
        'locked_at',
        'created_by',
    ];

    protected $casts = [
        'activities' => 'array',
        'safety_concerns' => 'array',
        'is_active' => 'boolean',
        'locked_at' => 'datetime',
    ];

    protected $appends = ['work_date_formatted', 'is_locked'];

    public function getIsLockedAttribute(): bool
    {
        if ($this->locked_at) {
            return true;
        }

        if (! $this->work_date) {
            return false;
        }

        return \Carbon\Carbon::parse($this->work_date)->lt(now('Australia/Brisbane')->startOfDay());
    }

    public function getWorkDateFormattedAttribute(): ?string
    {
        if (! $this->work_date) {
            return null;
        }

        return \Carbon\Carbon::parse($this->work_date)->format('D d/m/Y');
    }

    // --- Activity log ---

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnlyDirty()
            ->logFillable()
            ->useLogName('daily_prestart');
    }

    // --- Media collections ---

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('activity_files');
        $this->addMediaCollection('safety_concern_files');
        $this->addMediaCollection('builders_prestart_file');
    }

    // --- Relationships ---

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function foreman(): BelongsTo
    {
        return $this->belongsTo(User::class, 'foreman_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function signatures(): HasMany
    {
        return $this->hasMany(DailyPrestartSignature::class);
    }

    // --- Scopes ---

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForLocation($query, int $locationId)
    {
        return $query->where('location_id', $locationId);
    }

    public function scopeForDate($query, string $date)
    {
        return $query->whereDate('work_date', $date);
    }

    // --- Helpers ---

    public function getContentSnapshot(): array
    {
        return [
            'weather' => $this->weather,
            'weather_impact' => $this->weather_impact,
            'activities' => $this->activities,
            'safety_concerns' => $this->safety_concerns,
        ];
    }
}
