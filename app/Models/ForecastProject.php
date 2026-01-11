<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ForecastProject extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'project_number',
        'description',
        'total_cost_budget',
        'total_revenue_budget',
        'start_date',
        'end_date',
        'status',
    ];

    protected $casts = [
        'total_cost_budget' => 'decimal:2',
        'total_revenue_budget' => 'decimal:2',
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    /**
     * Get all cost items for this forecast project
     */
    public function costItems(): HasMany
    {
        return $this->hasMany(ForecastProjectCostItem::class)->orderBy('display_order');
    }

    /**
     * Get all revenue items for this forecast project
     */
    public function revenueItems(): HasMany
    {
        return $this->hasMany(ForecastProjectRevenueItem::class)->orderBy('display_order');
    }

    /**
     * Get all forecast data for this project
     */
    public function forecastData(): HasMany
    {
        return $this->hasMany(JobForecastData::class);
    }

    /**
     * Calculate total cost budget from cost items
     */
    public function calculateTotalCostBudget(): float
    {
        return $this->costItems()->sum('budget');
    }

    /**
     * Calculate total revenue budget from revenue items
     */
    public function calculateTotalRevenueBudget(): float
    {
        return $this->revenueItems()->sum('contract_sum_to_date');
    }
}
