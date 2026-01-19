<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CashForecastGeneralCost extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'description',
        'type',
        'amount',
        'includes_gst',
        'frequency',
        'start_date',
        'end_date',
        'category',
        'is_active',
        'flow_type',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'includes_gst' => 'boolean',
        'start_date' => 'date',
        'end_date' => 'date',
        'is_active' => 'boolean',
        'flow_type' => 'string',
    ];

    /**
     * Get the cash outflows for this cost within a date range.
     * Returns an array of [month => amount] for each month where payment occurs.
     */
    public function getCashflowsForRange(Carbon $startMonth, Carbon $endMonth): array
    {
        $cashflows = [];

        if (!$this->is_active) {
            return $cashflows;
        }

        $costStart = $this->start_date;
        $costEnd = $this->end_date ?? $endMonth->copy()->endOfMonth();

        // One-off payment
        if ($this->type === 'one_off') {
            $paymentMonth = $costStart->format('Y-m');
            if ($costStart->between($startMonth, $endMonth)) {
                $cashflows[$paymentMonth] = $this->getAmountWithGst();
            }
            return $cashflows;
        }

        // Recurring payments
        $current = $costStart->copy()->startOfMonth();
        while ($current->lte($endMonth) && $current->lte($costEnd)) {
            if ($current->gte($startMonth) && $current->gte($costStart->copy()->startOfMonth())) {
                if ($this->isPaymentDue($current)) {
                    $month = $current->format('Y-m');
                    $cashflows[$month] = ($cashflows[$month] ?? 0) + $this->getAmountWithGst();
                }
            }
            $current->addMonth();
        }

        return $cashflows;
    }

    /**
     * Check if a payment is due in the given month based on frequency.
     */
    private function isPaymentDue(Carbon $month): bool
    {
        $startMonth = $this->start_date->copy()->startOfMonth();
        $monthsDiff = $startMonth->diffInMonths($month);

        return match ($this->frequency) {
            'weekly' => true, // Weekly payments occur every month (4-5 times)
            'fortnightly' => true, // Fortnightly payments occur every month (2 times)
            'monthly' => true,
            'quarterly' => $monthsDiff % 3 === 0,
            'annually' => $monthsDiff % 12 === 0,
            default => false,
        };
    }

    /**
     * Get the monthly equivalent amount (for weekly/fortnightly).
     */
    public function getAmountWithGst(): float
    {
        $amount = (float) $this->amount;

        // Convert to monthly equivalent
        $monthlyAmount = match ($this->frequency) {
            'weekly' => $amount * 52 / 12,
            'fortnightly' => $amount * 26 / 12,
            default => $amount,
        };

        // Add GST if not already included
        if (!$this->includes_gst) {
            $monthlyAmount *= 1.1;
        }

        return $monthlyAmount;
    }

    /**
     * Get available categories.
     */
    public static function getCategories(): array
    {
        return [
            'rent' => 'Rent & Lease',
            'utilities' => 'Utilities',
            'insurance' => 'Insurance',
            'subscriptions' => 'Software & Subscriptions',
            'professional_services' => 'Professional Services',
            'marketing' => 'Marketing & Advertising',
            'equipment' => 'Equipment & Maintenance',
            'travel' => 'Travel & Accommodation',
            'training' => 'Training & Development',
            'other' => 'Other',
        ];
    }

    /**
     * Get available frequencies.
     */
    public static function getFrequencies(): array
    {
        return [
            'weekly' => 'Weekly',
            'fortnightly' => 'Fortnightly',
            'monthly' => 'Monthly',
            'quarterly' => 'Quarterly',
            'annually' => 'Annually',
        ];
    }
}
