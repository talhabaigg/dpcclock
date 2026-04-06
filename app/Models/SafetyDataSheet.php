<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class SafetyDataSheet extends Model implements HasMedia
{
    use InteractsWithMedia, SoftDeletes;

    protected $fillable = [
        'product_name',
        'manufacturer',
        'description',
        'hazard_classifications',
        'expires_at',
        'location_id',
        'created_by',
    ];

    protected $casts = [
        'hazard_classifications' => 'array',
        'expires_at' => 'date',
    ];

    public const HAZARD_CLASSIFICATIONS = [
        'Hazardous',
        'Non-Hazardous',
        'Dangerous Goods',
        'Non-Dangerous Goods',
    ];

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('sds_file')->singleFile();
        $this->addMediaCollection('other_files');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function locations(): BelongsToMany
    {
        return $this->belongsToMany(Location::class, 'location_safety_data_sheet')->withTimestamps();
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function scopeExpiringSoon($query, int $days)
    {
        return $query->whereBetween('expires_at', [now(), now()->addDays($days)]);
    }

    public function scopeExpired($query)
    {
        return $query->where('expires_at', '<', now());
    }
}
