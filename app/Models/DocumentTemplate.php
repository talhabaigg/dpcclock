<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentTemplate extends Model
{
    protected $fillable = [
        'name',
        'category',
        'body_json',
        'body_html',
        'placeholders',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'placeholders' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function signingRequests(): HasMany
    {
        return $this->hasMany(SigningRequest::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeCategory(Builder $query, string $category): Builder
    {
        return $query->where('category', $category);
    }

    public function getAvailablePlaceholders(): array
    {
        return $this->placeholders ?? [];
    }

    public function renderHtml(array $placeholderValues = []): string
    {
        $html = $this->body_html;

        foreach ($placeholderValues as $key => $value) {
            $html = str_replace('{{' . $key . '}}', e($value), $html);
        }

        return $html;
    }
}
