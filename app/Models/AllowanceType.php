<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AllowanceType extends Model
{
    protected $fillable = [
        'name',
        'code',
        'category',
        'description',
        'default_rate',
        'default_rate_type',
        'pay_category_id',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'default_rate' => 'decimal:2',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'pay_category_id' => 'integer',
    ];

    /**
     * Check if this is a fares/travel allowance
     */
    public function isFaresTravel(): bool
    {
        return $this->category === 'fares_travel';
    }

    /**
     * Check if this is a site allowance
     */
    public function isSite(): bool
    {
        return $this->category === 'site';
    }

    /**
     * Check if this is a multistorey allowance
     */
    public function isMultistorey(): bool
    {
        return $this->category === 'multistorey';
    }

    /**
     * Check if this is a custom allowance
     */
    public function isCustom(): bool
    {
        return $this->category === 'custom';
    }

    public function locationTemplateAllowances(): HasMany
    {
        return $this->hasMany(LocationTemplateAllowance::class);
    }

    /**
     * Scope to get only active allowance types
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to order by sort order and name
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('sort_order')->orderBy('name');
    }
}
