<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * User-facing classification for site tasks ("Builder Concerns",
 * "Potential Variation", ...). Drives the pin-head code + colour.
 * Distinct from SiteTask::type, which is structural.
 */
class SiteTaskCategory extends Model
{
    protected $fillable = ['name', 'code', 'color', 'sort_order', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function tasks(): HasMany
    {
        return $this->hasMany(SiteTask::class, 'category_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
