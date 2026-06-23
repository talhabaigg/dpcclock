<?php

namespace App\Models;

use App\Enums\SwmsVersionStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Swms extends Model
{
    use HasUuids, LogsActivity, SoftDeletes;

    protected $table = 'swms';

    protected $fillable = [
        'location_id',
        'name',
        'description',
        'created_by',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if ($model->created_by === null && auth()->check()) {
                $model->created_by = auth()->id();
            }
        });
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnlyDirty()
            ->logFillable()
            ->useLogName('swms');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(SwmsVersion::class)->orderByDesc('created_at');
    }

    public function activeVersion(): HasOne
    {
        return $this->hasOne(SwmsVersion::class)
            ->where('status', SwmsVersionStatus::Active->value);
    }
}
