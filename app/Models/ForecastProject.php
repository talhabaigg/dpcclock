<?php

namespace App\Models;

use App\Models\Concerns\HasComments;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class ForecastProject extends Model
{
    use HasComments, LogsActivity, SoftDeletes;

    protected $fillable = [
        'name',
        'project_number',
        'company',
        'description',
        'total_cost_budget',
        'total_revenue_budget',
        'start_date',
        'end_date',
        'status',
        'created_by',
        'updated_by',
        'deleted_by',
        'archived_at',
        'archived_by',
    ];

    protected $casts = [
        'total_cost_budget' => 'decimal:2',
        'total_revenue_budget' => 'decimal:2',
        'start_date' => 'date',
        'end_date' => 'date',
        'archived_at' => 'datetime',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnlyDirty()
            ->logFillable()
            ->useLogName('forecast_project');
    }

    /**
     * Auto-populate the audit columns from the authenticated user. Keeps controllers
     * free of boilerplate — any save/delete anywhere stamps the current user.
     */
    protected static function booted(): void
    {
        static::creating(function (self $project) {
            if (Auth::id()) {
                $project->created_by ??= Auth::id();
                $project->updated_by ??= Auth::id();
            }
        });

        static::created(function (self $project) {
            $project->addSystemComment(
                "Project **created**",
                ['event' => 'created', 'status' => $project->status],
            );
        });

        static::updating(function (self $project) {
            if (Auth::id()) {
                $project->updated_by = Auth::id();
            }
        });

        static::updated(function (self $project) {
            if ($project->wasChanged('status')) {
                $project->addSystemComment(
                    sprintf(
                        'Status changed from **%s** to **%s**',
                        $project->getOriginal('status'),
                        $project->status,
                    ),
                    ['event' => 'status_changed', 'from' => $project->getOriginal('status'), 'to' => $project->status],
                );
            }
            if ($project->wasChanged('archived_at')) {
                if ($project->archived_at) {
                    $project->addSystemComment('Project **archived**', ['event' => 'archived']);
                } else {
                    $project->addSystemComment('Project **restored from archive**', ['event' => 'unarchived']);
                }
            }
        });

        static::deleting(function (self $project) {
            if (Auth::id() && ! $project->isForceDeleting()) {
                $project->deleted_by = Auth::id();
                $project->saveQuietly();
                $project->addSystemComment('Project **deleted**', ['event' => 'deleted']);
            }
        });

        static::restored(function (self $project) {
            $project->addSystemComment('Project **restored**', ['event' => 'restored']);
        });
    }

    public function archive(?int $userId = null): void
    {
        $this->archived_at = Carbon::now();
        $this->archived_by = $userId ?? Auth::id();
        $this->save();
    }

    public function unarchive(): void
    {
        $this->archived_at = null;
        $this->archived_by = null;
        $this->save();
    }

    public function scopeArchived(Builder $q): Builder
    {
        return $q->whereNotNull('archived_at');
    }

    public function scopeNotArchived(Builder $q): Builder
    {
        return $q->whereNull('archived_at');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function deleter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }

    public function archiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'archived_by');
    }

    public function costItems(): HasMany
    {
        return $this->hasMany(ForecastProjectCostItem::class)->orderBy('display_order');
    }

    public function revenueItems(): HasMany
    {
        return $this->hasMany(ForecastProjectRevenueItem::class)->orderBy('display_order');
    }

    public function forecastData(): HasMany
    {
        return $this->hasMany(JobForecastData::class);
    }

    public function calculateTotalCostBudget(): float
    {
        return $this->costItems()->sum('budget');
    }

    public function calculateTotalRevenueBudget(): float
    {
        return $this->revenueItems()->sum('contract_sum_to_date');
    }
}
