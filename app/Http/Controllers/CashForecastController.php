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
        // Base forecast data for the next 12 months.
        $forecastData = JobForecastData::select('month', 'cost_item', 'forecast_amount', 'job_number')->get();
        $rules = $this->getForecastRules();
        $allMonths = $this->generateMonthRange(Carbon::now(), 12);

        $forecastRows = $this->applyRules($forecastData, $rules);
        $gstPayableRows = $this->calculateQuarterlyGstPayable($forecastRows, $rules);

        $allMonthsWithCostSummary = $this->buildMonthHierarchy(
            $allMonths,
            $forecastRows->concat($gstPayableRows)
        );

        return Inertia::render('cash-forecast/show', [
            'months' => $allMonthsWithCostSummary,
        ]);
    }

    private function getForecastRules()
    {
        return [
            // Cash-in cost item (used to separate inflows vs outflows).
            'cash_in_code' => '99-99',
            // Cost item code to represent GST payable in the cash flow.
            'gst_payable_code' => 'GST-PAYABLE',
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
                '03-01' => [
                    ['delay' => 1, 'ratio' => 0.30],
                    ['delay' => 0, 'ratio' => 0.70],
                ],
                '05-01' => [
                    ['delay' => 1, 'ratio' => 0.30],
                    ['delay' => 0, 'ratio' => 0.70],
                ],
                '07-01' => [
                    ['delay' => 1, 'ratio' => 0.30],
                    ['delay' => 0, 'ratio' => 0.70],
                ],
            ],
            // GST rates by cost item code (e.g., 0.10 for 10%).
            'cost_item_gst_rates' => [
                '01-01' => 0.10,
                '99-99' => 0.10,
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

            // GST applies after any delay/split logic, so keep a single multiplier.
            $gstMultiplier = 1 + $gstRate;

            if (isset($costItemDelaySplits[$item->cost_item])) {
                // Split a single forecast row into multiple delayed rows by ratio.
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

            // Default path: apply a single delay and GST multiplier.
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
        // Organize rows so the UI can render month -> cash in/out -> cost item -> job.
        $forecastByMonth = $forecastRows->groupBy('month');
        $cashInCode = $this->getForecastRules()['cash_in_code'] ?? '99-99';

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
        // Extract "01" from "01-01" style cost item codes.
        if (preg_match('/^(\d{2})-/', $costItem, $matches)) {
            return (int) $matches[1];
        }

        return null;
    }

    private function calculateQuarterlyGstPayable($forecastRows, array $rules)
    {
        $cashInCode = $rules['cash_in_code'] ?? '99-99';
        $gstPayableCode = $rules['gst_payable_code'] ?? 'GST-PAYABLE';
        $costItemGstRates = $rules['cost_item_gst_rates'] ?? [];
        $gstPrefix = $rules['gst_prefix'] ?? [];

        $monthlyGst = $forecastRows->reduce(function ($carry, $row) use ($cashInCode, $costItemGstRates, $gstPrefix) {
            $gstRate = $costItemGstRates[$row->cost_item] ?? 0;
            if ($gstRate === 0) {
                $prefix = $this->getCostItemPrefix($row->cost_item);
                if ($this->isPrefixInRange($prefix, $gstPrefix['min'] ?? null, $gstPrefix['max'] ?? null)) {
                    $gstRate = $gstPrefix['rate'] ?? 0;
                }
            }

            if ($gstRate <= 0) {
                return $carry;
            }

            $gstAmount = $this->extractGstFromGross((float) $row->forecast_amount, (float) $gstRate);
            $monthKey = $row->month;
            if (!isset($carry[$monthKey])) {
                $carry[$monthKey] = ['collected' => 0.0, 'paid' => 0.0];
            }

            if ($row->cost_item === $cashInCode) {
                $carry[$monthKey]['collected'] += $gstAmount;
            } else {
                $carry[$monthKey]['paid'] += $gstAmount;
            }

            return $carry;
        }, []);

        $quarterBuckets = [];
        foreach ($monthlyGst as $month => $amounts) {
            $date = Carbon::createFromFormat('Y-m', $month);
            $key = $date->year . '-Q' . $date->quarter;

            if (!isset($quarterBuckets[$key])) {
                $quarterBuckets[$key] = [
                    'year' => $date->year,
                    'quarter' => $date->quarter,
                    'collected' => 0.0,
                    'paid' => 0.0,
                ];
            }

            $quarterBuckets[$key]['collected'] += $amounts['collected'];
            $quarterBuckets[$key]['paid'] += $amounts['paid'];
        }

        $rows = collect();
        foreach ($quarterBuckets as $bucket) {
            $netGst = $bucket['collected'] - $bucket['paid'];
            if (abs($netGst) < 0.01) {
                continue;
            }

            // Net GST for the quarter is paid the following month.
            $payableMonth = Carbon::create($bucket['year'], $bucket['quarter'] * 3, 1)
                ->addMonth()
                ->format('Y-m');

            $rows->push((object) [
                'month' => $payableMonth,
                'cost_item' => $gstPayableCode,
                'job_number' => 'GST',
                'forecast_amount' => (float) $netGst,
            ]);
        }

        return $rows;
    }

    private function extractGstFromGross(float $grossAmount, float $rate)
    {
        if ($rate <= 0) {
            return 0.0;
        }

        return $grossAmount - ($grossAmount / (1 + $rate));
    }

    private function isPrefixInRange($prefix, $min, $max)
    {
        if ($prefix === null || $min === null || $max === null) {
            return false;
        }

        return $prefix >= $min && $prefix <= $max;
    }
}
