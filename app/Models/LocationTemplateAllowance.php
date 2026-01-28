<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LocationTemplateAllowance extends Model
{
    protected $fillable = [
        'location_pay_rate_template_id',
        'allowance_type_id',
        'rate',
        'rate_type',
        'is_active',
        'paid_to_rdo',
    ];

    protected $casts = [
        'rate' => 'decimal:2',
        'is_active' => 'boolean',
        'paid_to_rdo' => 'boolean',
    ];

    public function locationPayRateTemplate(): BelongsTo
    {
        return $this->belongsTo(LocationPayRateTemplate::class);
    }

    public function allowanceType(): BelongsTo
    {
        return $this->belongsTo(AllowanceType::class);
    }

    /**
     * Calculate weekly cost based on rate type
     * - hourly: rate × 40 hours
     * - daily: rate × 5 days
     * - weekly: rate as-is
     */
    public function getWeeklyCost(): float
    {
        $rate = (float) $this->rate;

        return match ($this->rate_type) {
            'hourly' => $rate * 40,
            'daily' => $rate * 5,
            'weekly' => $rate,
            default => 0,
        };
    }

    /**
     * Scope to get only active allowances
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get allowances paid during RDO
     */
    public function scopePaidToRdo($query)
    {
        return $query->where('paid_to_rdo', true);
    }
}
