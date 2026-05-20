<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FormField extends Model
{
    protected $fillable = [
        'form_template_id',
        'label',
        'type',
        'sort_order',
        'is_required',
        'options',
        'options_source',
        'placeholder',
        'help_text',
        'default_value',
        'visible_if',
    ];

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'options' => 'array',
            'visible_if' => 'array',
        ];
    }

    public function formTemplate(): BelongsTo
    {
        return $this->belongsTo(FormTemplate::class);
    }

    public function isDisplayOnly(): bool
    {
        return in_array($this->type, ['heading', 'paragraph', 'page_break']);
    }

    public function hasOptions(): bool
    {
        return in_array($this->type, ['select', 'radio', 'checkbox', 'multiselect', 'button_group', 'button_group_multi']);
    }

    public function hasDynamicOptions(): bool
    {
        return $this->hasOptions() && ! empty($this->options_source);
    }
}
