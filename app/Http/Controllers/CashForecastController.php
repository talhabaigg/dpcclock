<?php

namespace App\Http\Controllers;

use App\Models\JobForecastData;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CashForecastController extends Controller
{
    public function __invoke(Request $request)
    {
        $forecastData = JobForecastData::select('month', 'cost_item', 'forecast_amount', 'job_number')->get();
        $rules = $this->getForecastRules();
        // $maxDelayMonths = $this->getMaxDelayMonths($rules);
        $allMonths = $this->generateMonthRange(Carbon::now(), 12);

        $allMonthsWithCostSummary = $this->buildMonthHierarchy(
            $allMonths,
            $this->applyRules($forecastData, $rules)
        );

        return Inertia::render('cash-forecast/show', [
            'months' => $allMonthsWithCostSummary,
        ]);
    }

    private function getForecastRules()
    {
        return [
            // Delay rules in months by cost item code.
            'cost_item_delays' => [
                '01-01' => 1,
                '99-99' => 2,
            ],
            // Split rules by cost item code. Each entry is [delayMonths, ratio].
            'cost_item_delay_splits' => [
                '01-01' => [
                    ['delay' => 1, 'ratio' => 0.30],
                    ['delay' => 0, 'ratio' => 0.70],
                ],
            ],
            // GST rates by cost item code (e.g., 0.10 for 10%).
            'cost_item_gst_rates' => [
                '01-01' => 0.10,
            ],
            // Prefix-based GST rule.
            'gst_prefix' => [
                'min' => 20,
                'max' => 98,
                'rate' => 0.10,
            ],
            // Prefix-based base delay rule.
            'delay_prefix' => [
                'min' => 20,
                'max' => 98,
                'months' => 1,
            ],
        ];
    }

    // private function getMaxDelayMonths(array $rules)
    // {
    //     $explicitDelays = array_values($rules['cost_item_delays'] ?? []);
    //     $splitDelays = collect($rules['cost_item_delay_splits'] ?? [])->flatten(1)->pluck('delay')->all();
    //     $prefixDelay = $rules['delay_prefix']['months'] ?? 0;
    //     $allDelays = array_merge($explicitDelays, $splitDelays, [$prefixDelay]);

    //     return !empty($allDelays) ? max($allDelays) : 0;
    // }

    private function generateMonthRange(Carbon $start, int $monthsForward)
    {
        $currentMonth = $start->format('Y-m');
        $endMonth = $start->copy()->addMonths($monthsForward)->format('Y-m');
        $months = [];
        $period = Carbon::parse($currentMonth);
        while ($period->format('Y-m') <= $endMonth) {
            $months[] = $period->format('Y-m');
            $period->addMonth();
        }

        return $months;
    }

    private function applyRules($forecastData, array $rules)
    {
        $costItemDelays = $rules['cost_item_delays'] ?? [];
        $costItemDelaySplits = $rules['cost_item_delay_splits'] ?? [];
        $costItemGstRates = $rules['cost_item_gst_rates'] ?? [];
        $gstPrefix = $rules['gst_prefix'] ?? [];
        $delayPrefix = $rules['delay_prefix'] ?? [];

        return $forecastData->flatMap(function ($item) use ($costItemDelays, $costItemDelaySplits, $costItemGstRates, $gstPrefix, $delayPrefix) {
            $prefix = $this->getCostItemPrefix($item->cost_item);
            $gstRate = $costItemGstRates[$item->cost_item] ?? 0;
            if ($gstRate === 0 && $this->isPrefixInRange($prefix, $gstPrefix['min'] ?? null, $gstPrefix['max'] ?? null)) {
                $gstRate = $gstPrefix['rate'] ?? 0;
            }

            $baseDelayMonths = 0;
            if ($this->isPrefixInRange($prefix, $delayPrefix['min'] ?? null, $delayPrefix['max'] ?? null)) {
                $baseDelayMonths = (int) ($delayPrefix['months'] ?? 0);
            }

            $gstMultiplier = 1 + $gstRate;

            if (isset($costItemDelaySplits[$item->cost_item])) {
                return collect($costItemDelaySplits[$item->cost_item])->map(function ($split) use ($item, $gstMultiplier, $baseDelayMonths) {
                    $delayedMonth = Carbon::createFromFormat('Y-m', $item->month)
                        ->addMonths($baseDelayMonths + $split['delay'])
                        ->format('Y-m');

                    return (object) [
                        'month' => $delayedMonth,
                        'cost_item' => $item->cost_item,
                        'job_number' => $item->job_number,
                        'forecast_amount' => (float) $item->forecast_amount * (float) $split['ratio'] * $gstMultiplier,
                    ];
                });
            }

            $delayMonths = $baseDelayMonths + ($costItemDelays[$item->cost_item] ?? 0);
            $delayedMonth = Carbon::createFromFormat('Y-m', $item->month)
                ->addMonths($delayMonths)
                ->format('Y-m');

            return [
                (object) [
                    'month' => $delayedMonth,
                    'cost_item' => $item->cost_item,
                    'job_number' => $item->job_number,
                    'forecast_amount' => (float) $item->forecast_amount * $gstMultiplier,
                ],
            ];
        });
    }

    private function buildMonthHierarchy(array $months, $forecastRows)
    {
        $forecastByMonth = $forecastRows->groupBy('month');
        $cashInCode = '99-99';

        return collect($months)->map(function ($month) use ($forecastByMonth, $cashInCode) {
            $monthItems = $forecastByMonth->get($month, collect());
            $cashInItems = $monthItems->filter(function ($item) use ($cashInCode) {
                return $item->cost_item === $cashInCode;
            });
            $cashOutItems = $monthItems->filter(function ($item) use ($cashInCode) {
                return $item->cost_item !== $cashInCode;
            });

            $cashInCostItems = $cashInItems
                ->groupBy('cost_item')
                ->map(function ($items, $costItem) {
                    $jobs = $items
                        ->groupBy('job_number')
                        ->map(function ($jobItems, $jobNumber) {
                            return [
                                'job_number' => $jobNumber,
                                'total' => (float) $jobItems->sum('forecast_amount'),
                            ];
                        })
                        ->values();

                    return [
                        'cost_item' => $costItem,
                        'total' => (float) $items->sum('forecast_amount'),
                        'jobs' => $jobs,
                    ];
                })
                ->sortBy('cost_item')
                ->values();
            $cashOutCostItems = $cashOutItems
                ->groupBy('cost_item')
                ->map(function ($items, $costItem) {
                    $jobs = $items
                        ->groupBy('job_number')
                        ->map(function ($jobItems, $jobNumber) {
                            return [
                                'job_number' => $jobNumber,
                                'total' => (float) $jobItems->sum('forecast_amount'),
                            ];
                        })
                        ->values();

                    return [
                        'cost_item' => $costItem,
                        'total' => (float) $items->sum('forecast_amount'),
                        'jobs' => $jobs,
                    ];
                })
                ->sortBy('cost_item')
                ->values();

            $cashInTotal = (float) $cashInItems->sum('forecast_amount');
            $cashOutTotal = (float) $cashOutItems->sum('forecast_amount');

            return [
                'month' => $month,
                'cash_in' => [
                    'total' => $cashInTotal,
                    'cost_items' => $cashInCostItems,
                ],
                'cash_out' => [
                    'total' => $cashOutTotal,
                    'cost_items' => $cashOutCostItems,
                ],
                'net' => $cashInTotal - $cashOutTotal,
            ];
        })->values();
    }

    private function getCostItemPrefix($costItem)
    {
        if (preg_match('/^(\d{2})-/', $costItem, $matches)) {
            return (int) $matches[1];
        }

        return null;
    }

    private function isPrefixInRange($prefix, $min, $max)
    {
        if ($prefix === null || $min === null || $max === null) {
            return false;
        }

        return $prefix >= $min && $prefix <= $max;
    }
}
