<?php

namespace App\Models;

use App\Models\Concerns\HasComments;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Log;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class DailyPrestart extends Model implements HasMedia
{
    use HasComments, HasUuids, InteractsWithMedia, LogsActivity, SoftDeletes;

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
        'manually_unlocked_at',
        'created_by',
    ];

    protected $casts = [
        'activities' => 'array',
        'safety_concerns' => 'array',
        'weather' => 'array',
        'is_active' => 'boolean',
        'locked_at' => 'datetime',
        'manually_unlocked_at' => 'datetime',
    ];

    protected $appends = ['work_date_formatted', 'is_locked'];

    public function getIsLockedAttribute(): bool
    {
        if ($this->locked_at) {
            return true;
        }

        // Explicit unlock overrides the past-date auto-lock below
        if ($this->manually_unlocked_at) {
            return false;
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

    public function absenceNotes(): HasMany
    {
        return $this->hasMany(DailyPrestartAbsenceNote::class);
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

    /**
     * Dispatch an async refresh of the weather payload if it's stale.
     *
     * Stale = work_date is today (Brisbane) and the stored weather was
     * either never fetched or fetched on a different Brisbane day.
     * Future- or past-dated prestarts are left alone.
     *
     * Runs as a queued job (ShouldBeUnique) so the request handler doesn't
     * block on Google's Weather API and duplicate dispatches are deduped.
     */
    public function ensureFreshWeatherQueued(): void
    {
        $todayBrisbane = now('Australia/Brisbane')->format('Y-m-d');

        $workDate = $this->work_date instanceof \Carbon\Carbon
            ? $this->work_date->format('Y-m-d')
            : (string) $this->work_date;

        // Only refresh on the prestart's actual work day
        if ($workDate !== $todayBrisbane) {
            return;
        }

        $fetchedAt = is_array($this->weather) ? ($this->weather['fetched_at'] ?? null) : null;

        if ($fetchedAt) {
            try {
                $fetchedDateBrisbane = \Carbon\Carbon::parse($fetchedAt)
                    ->timezone('Australia/Brisbane')
                    ->format('Y-m-d');
                if ($fetchedDateBrisbane === $todayBrisbane) {
                    return; // already fresh today
                }
            } catch (\Throwable $e) {
                Log::warning('DailyPrestart::ensureFreshWeatherQueued - bad fetched_at format', [
                    'prestart_id' => $this->id,
                    'fetched_at' => $fetchedAt,
                ]);
                // Fall through and dispatch refresh
            }
        }

        \App\Jobs\RefreshPrestartWeather::dispatch($this->id);
    }
}
