<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Checklist extends Model
{
    protected $fillable = [
        'checklist_template_id',
        'checkable_type',
        'checkable_id',
        'name',
        'sort_order',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(ChecklistTemplate::class, 'checklist_template_id');
    }

    public function checkable(): MorphTo
    {
        return $this->morphTo();
    }

    public function items(): HasMany
    {
        return $this->hasMany(ChecklistItem::class)->orderBy('sort_order');
    }

    public function requiredItems(): HasMany
    {
        return $this->hasMany(ChecklistItem::class)->where('is_required', true);
    }

    public function allRequiredComplete(): bool
    {
        return $this->requiredItems()->whereNull('completed_at')->doesntExist();
    }
}
