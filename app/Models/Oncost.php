<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Oncost extends Model
{
    protected $fillable = [
        'name',
        'code',
        'description',
        'weekly_amount',
        'is_percentage',
        'percentage_rate',
        'applies_to_overtime',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'weekly_amount' => 'decimal:2',
        'hourly_rate' => 'decimal:4',
        'is_percentage' => 'boolean',
        'percentage_rate' => 'decimal:4',
        'applies_to_overtime' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    /**
     * Scope to get only active oncosts
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get only fixed (non-percentage) oncosts
     */
    public function scopeFixed($query)
    {
        return $query->where('is_percentage', false);
    }

    /**
     * Scope to get only percentage-based oncosts
     */
    public function scopePercentage($query)
    {
        return $query->where('is_percentage', true);
    }

    /**
     * Scope to order by sort order and name
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('sort_order')->orderBy('name');
    }

    /**
     * Calculate the cost for given hours
     */
    public function calculateForHours(float $hours): float
    {
        if ($this->is_percentage) {
            return 0; // Percentage oncosts are calculated differently
        }

        return $hours * (float) $this->hourly_rate;
    }

    /**
     * Calculate the percentage cost for given taxable base
     */
    public function calculatePercentage(float $taxableBase): float
    {
        if (! $this->is_percentage || ! $this->percentage_rate) {
            return 0;
        }

        return $taxableBase * (float) $this->percentage_rate;
    }

    /**
     * Get formatted weekly amount
     */
    public function getFormattedWeeklyAttribute(): string
    {
        return '$'.number_format((float) $this->weekly_amount, 2);
    }

    /**
     * Get formatted hourly rate
     */
    public function getFormattedHourlyAttribute(): string
    {
        return '$'.number_format((float) $this->hourly_rate, 4);
    }

    /**
     * Get formatted percentage rate
     */
    public function getFormattedPercentageAttribute(): ?string
    {
        if (! $this->is_percentage || ! $this->percentage_rate) {
            return null;
        }

        return number_format((float) $this->percentage_rate * 100, 2).'%';
    }
}
