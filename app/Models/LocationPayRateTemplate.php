<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LocationPayRateTemplate extends Model
{
    protected $table = 'location_pay_rate_templates';

    protected $fillable = [
        'location_id',
        'pay_rate_template_id',
        'custom_label',
        'hourly_rate',
        'cost_code_prefix',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'hourly_rate' => 'decimal:2',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function payRateTemplate(): BelongsTo
    {
        return $this->belongsTo(PayRateTemplate::class);
    }

    /**
     * Get active custom allowances for this template configuration
     */
    public function customAllowances(): HasMany
    {
        return $this->hasMany(LocationTemplateAllowance::class)
            ->where('is_active', true)
            ->with('allowanceType');
    }

    /**
     * Get all custom allowances (including inactive) for this template configuration
     */
    public function allCustomAllowances(): HasMany
    {
        return $this->hasMany(LocationTemplateAllowance::class)
            ->with('allowanceType');
    }

    /**
     * Get the display label (custom label or template name)
     */
    public function getDisplayLabelAttribute(): string
    {
        return $this->custom_label ?: $this->payRateTemplate?->name ?? 'Unknown';
    }

    /**
     * Calculate hourly rate from "Permanent Ordinary Hours" pay category
     */
    public function calculateHourlyRate(): ?float
    {
        $template = $this->payRateTemplate()->with('payCategories.payCategory')->first();
        if (!$template) {
            return null;
        }

        // Find the "Permanent Ordinary Hours" pay category
        foreach ($template->payCategories as $payCategory) {
            $categoryName = $payCategory->payCategory?->name ?? $payCategory->pay_category_name;
            if ($categoryName && stripos($categoryName, 'Permanent Ordinary Hours') !== false) {
                // Return the calculated rate (or user supplied rate if no calculated rate)
                return $payCategory->calculated_rate > 0
                    ? (float) $payCategory->calculated_rate
                    : (float) $payCategory->user_supplied_rate;
            }
        }

        return null;
    }

    /**
     * Update the cached hourly rate
     */
    public function refreshHourlyRate(): void
    {
        $this->hourly_rate = $this->calculateHourlyRate();
        $this->save();
    }
}
