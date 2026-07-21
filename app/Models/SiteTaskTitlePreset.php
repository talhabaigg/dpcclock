<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Predefined task title offered during quick task creation. Scoped to one
 * SiteTaskCategory, or global (null category) — global presets appear under
 * every category. Purely a naming convenience: tasks store the plain title
 * string, never a reference back to the preset.
 */
class SiteTaskTitlePreset extends Model
{
    protected $fillable = ['category_id', 'title', 'sort_order', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(SiteTaskCategory::class, 'category_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
