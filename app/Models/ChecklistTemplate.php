<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChecklistTemplate extends Model
{
    protected $fillable = [
        'name',
        'model_type',
        'auto_attach',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'auto_attach' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(ChecklistTemplateItem::class)->orderBy('sort_order');
    }

    public function checklists(): HasMany
    {
        return $this->hasMany(Checklist::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForModel($query, string $modelClass)
    {
        return $query->where(function ($q) use ($modelClass) {
            $q->where('model_type', $modelClass)->orWhereNull('model_type');
        });
    }

    public function scopeAutoAttach($query)
    {
        return $query->where('auto_attach', true);
    }
}
