<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ModelTriggerForm extends Model
{
    protected $fillable = [
        'model_type',
        'trigger_key',
        'form_template_id',
        'assignee_strategy',
        'assignee_value',
        'is_required',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function formTemplate(): BelongsTo
    {
        return $this->belongsTo(FormTemplate::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeForModelTrigger(Builder $query, string $modelClass, string $triggerKey): Builder
    {
        return $query->where('model_type', $modelClass)
            ->where('trigger_key', $triggerKey)
            ->orderBy('sort_order');
    }

    public function resolveAssignee(): ?User
    {
        return match ($this->assignee_strategy) {
            'role' => User::role($this->assignee_value)->first(),
            'user' => User::find($this->assignee_value),
            default => null,
        };
    }
}
