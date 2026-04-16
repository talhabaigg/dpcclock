<?php

namespace App\Models;

use App\Enums\SilicaOptionType;
use Illuminate\Database\Eloquent\Model;

class SilicaOption extends Model
{
    protected $fillable = [
        'type',
        'label',
        'active',
        'sort_order',
    ];

    protected $casts = [
        'type' => SilicaOptionType::class,
        'active' => 'boolean',
    ];

    public function scopeActive($query)
    {
        return $query->where('active', true);
    }

    public function scopeOfType($query, SilicaOptionType $type)
    {
        return $query->where('type', $type);
    }
}
