<?php

namespace App\Http\Controllers;

use App\Models\ArProgressBillingSummary;
use App\Models\CashForecastGeneralCost;
use App\Models\CashForecastSetting;
use App\Models\CostCode;
use App\Models\JobCostDetail;
use App\Models\JobForecastData;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CashForecastController extends Controller
{
    public function __invoke(Request $request)
    {
        $rules = $this->getForecastRules();
        $currentMonth = Carbon::now()->format('Y-m');

        // Get settings (starting balance)
        $settings = CashForecastSetting::current();

        // Get cost code descriptions for display
        $costCodeDescriptions = $this->getCostCodeDescriptions();

        // Get actuals from past months (costs and revenue)
        $actualData = $this->getActualData($rules);

        // Get forecast data for current month onwards
        $forecastData = JobForecastData::select('month', 'cost_item', 'forecast_amount', 'job_number')
            ->where('month', '>=', $currentMonth)
            ->get();

        // Combine actuals and forecasts
        $combinedData = $actualData->concat($forecastData);

        // Generate month range starting from current month
        $allMonths = $this->generateMonthRange(Carbon::now(), 12);

        $transformedRows = $this->applyRules($combinedData, $rules);

        // Add general costs
        $generalCostRows = $this->getGeneralCostRows($allMonths);
        $transformedRows = $transformedRows->concat($generalCostRows);

        $gstPayableRows = $this->calculateQuarterlyGstPayable($transformedRows, $rules);

        $allMonthsWithCostSummary = $this->buildMonthHierarchy(
            $allMonths,
            $transformedRows->concat($gstPayableRows),
            $costCodeDescriptions
        );

        // Get general costs for the settings panel
        $generalCosts = CashForecastGeneralCost::where('is_active', true)
            ->orderBy('name')
            ->get();

        return Inertia::render('cash-forecast/show', [
            'months' => $allMonthsWithCostSummary,
            'currentMonth' => $currentMonth,
            'costCodeDescriptions' => $costCodeDescriptions,
            'settings' => [
                'startingBalance' => (float) $settings->starting_balance,
                'startingBalanceDate' => $settings->starting_balance_date?->format('Y-m-d'),
            ],
            'generalCosts' => $generalCosts,
            'categories' => CashForecastGeneralCost::getCategories(),
            'frequencies' => CashForecastGeneralCost::getFrequencies(),
        ]);
    }

    /**
     * Update cash forecast settings.
     */
    public function updateSettings(Request $request)
    {
        $validated = $request->validate([
            'starting_balance' => 'required|numeric',
            'starting_balance_date' => 'nullable|date',
        ]);

        $settings = CashForecastSetting::current();
        $settings->update($validated);

        return back()->with('success', 'Settings updated successfully.');
    }

    /**
     * Store a new general cost.
     */
    public function storeGeneralCost(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:255',
            'type' => 'required|in:one_off,recurring',
            'amount' => 'required|numeric|min:0',
            'includes_gst' => 'boolean',
            'frequency' => 'nullable|in:weekly,fortnightly,monthly,quarterly,annually',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'category' => 'nullable|string|max:50',
        ]);

        CashForecastGeneralCost::create($validated);

        return back()->with('success', 'General cost added successfully.');
    }

    /**
     * Update a general cost.
     */
    public function updateGeneralCost(Request $request, CashForecastGeneralCost $generalCost)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:255',
            'type' => 'required|in:one_off,recurring',
            'amount' => 'required|numeric|min:0',
            'includes_gst' => 'boolean',
            'frequency' => 'nullable|in:weekly,fortnightly,monthly,quarterly,annually',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'category' => 'nullable|string|max:50',
            'is_active' => 'boolean',
        ]);

        $generalCost->update($validated);

        return back()->with('success', 'General cost updated successfully.');
    }

    /**
     * Delete a general cost.
     */
    public function destroyGeneralCost(CashForecastGeneralCost $generalCost)
    {
        $generalCost->delete();

        return back()->with('success', 'General cost deleted successfully.');
    }

    /**
     * Get cost code descriptions from the database.
     */
    private function getCostCodeDescriptions(): array
    {
        return CostCode::pluck('description', 'code')->toArray();
    }

    /**
     * Get general cost rows for the forecast period.
     */
    private function getGeneralCostRows(array $months): \Illuminate\Support\Collection
    {
        $generalCosts = CashForecastGeneralCost::where('is_active', true)->get();
        $rows = collect();

        if ($generalCosts->isEmpty()) {
            return $rows;
        }

        $startMonth = Carbon::createFromFormat('Y-m', $months[0])->startOfMonth();
        $endMonth = Carbon::createFromFormat('Y-m', end($months))->endOfMonth();

        foreach ($generalCosts as $cost) {
            $cashflows = $cost->getCashflowsForRange($startMonth, $endMonth);

            foreach ($cashflows as $month => $amount) {
                $rows->push((object) [
                    'month' => $month,
                    'cost_item' => 'GENERAL-' . strtoupper($cost->category ?? 'OTHER'),
                    'job_number' => $cost->name,
                    'forecast_amount' => $amount,
                    'gst_rate' => $cost->includes_gst ? 0.10 : 0,
                    'is_general_cost' => true,
                ]);
            }
        }

        return $rows;
    }

    /**
     * Get actual cost and revenue data from JobCostDetail and ArProgressBillingSummary.
     * This provides the historical data needed for cash flow calculations with delays.
     */
    private function getActualData(array $rules): \Illuminate\Support\Collection
    {
        $cashInCode = $rules['cash_in_code'];

        // Get cost actuals - need data from past months to account for payment delays
        $costActuals = JobCostDetail::select('job_number', 'cost_item', 'transaction_date', 'amount')
            ->where('transaction_date', '>=', Carbon::now()->subMonths(3)->startOfMonth())
            ->get()
            ->map(function ($item) {
                return (object) [
                    'job_number' => $item->job_number,
                    'cost_item' => $item->cost_item,
                    'month' => Carbon::parse($item->transaction_date)->format('Y-m'),
                    'forecast_amount' => (float) $item->amount,
                    'is_actual' => true,
                ];
            });

        // Get revenue actuals
        $revenueActuals = ArProgressBillingSummary::select('job_number', 'period_end_date', 'this_app_work_completed')
            ->where('period_end_date', '>=', Carbon::now()->subMonths(3)->startOfMonth())
            ->get()
            ->map(function ($item) use ($cashInCode) {
                return (object) [
                    'job_number' => $item->job_number,
                    'cost_item' => $cashInCode,
                    'month' => Carbon::parse($item->period_end_date)->format('Y-m'),
                    'forecast_amount' => (float) $item->this_app_work_completed,
                    'is_actual' => true,
                ];
            });

        return $costActuals->concat($revenueActuals);
    }

    private function getForecastRules()
    {
        return [
            // Cash-in cost item (used to separate inflows vs outflows).
            'cash_in_code' => '99-99',
            // Cost item code to represent GST payable in the cash flow.
            'gst_payable_code' => 'GST-PAYABLE',
            // General cost code prefix
            'general_cost_prefix' => 'GENERAL-',

            // =================================================================
            // RULE 1: Wages (01-01, 03-01, 05-01, 07-01)
            // Split 30% tax (paid +1 month) / 70% wages (paid same month)
            // NO GST on wages
            // =================================================================
            'cost_item_delay_splits' => [
                '01-01' => [
                    ['delay' => 0, 'ratio' => 0.70],  // 70% wages paid same month
                    ['delay' => 1, 'ratio' => 0.30],  // 30% tax paid next month
                ],
                '03-01' => [
                    ['delay' => 0, 'ratio' => 0.70],
                    ['delay' => 1, 'ratio' => 0.30],
                ],
                '05-01' => [
                    ['delay' => 0, 'ratio' => 0.70],
                    ['delay' => 1, 'ratio' => 0.30],
                ],
                '07-01' => [
                    ['delay' => 0, 'ratio' => 0.70],
                    ['delay' => 1, 'ratio' => 0.30],
                ],
            ],

            // Wage codes - NO GST applied (explicitly listed to exclude from GST)
            'wage_codes' => ['01-01', '03-01', '05-01', '07-01'],

            // =================================================================
            // RULE 2: Oncosts (prefixes 02, 04, 06, 08)
            // Paid +1 month, NO GST
            // =================================================================
            'oncost_prefixes' => [2, 4, 6, 8],
            'oncost_delay_months' => 1,

            // =================================================================
            // RULE 3: Vendor costs (prefixes 20-98)
            // GST 10% (multiplier 1.1) + delay +1 month (30 day terms)
            // =================================================================
            'vendor_cost_prefix' => [
                'min' => 20,
                'max' => 98,
                'gst_rate' => 0.10,
                'delay_months' => 1,
            ],

            // =================================================================
            // RULE 4: Revenue (99-99)
            // GST 10% collected + delay +2 months
            // =================================================================
            'revenue_gst_rate' => 0.10,
            'revenue_delay_months' => 2,
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
        $cashInCode = $rules['cash_in_code'];
        $wageCodes = $rules['wage_codes'] ?? [];
        $costItemDelaySplits = $rules['cost_item_delay_splits'] ?? [];
        $oncostPrefixes = $rules['oncost_prefixes'] ?? [];
        $oncostDelayMonths = $rules['oncost_delay_months'] ?? 1;
        $vendorCostPrefix = $rules['vendor_cost_prefix'] ?? [];
        $revenueGstRate = $rules['revenue_gst_rate'] ?? 0.10;
        $revenueDelayMonths = $rules['revenue_delay_months'] ?? 2;
        $generalCostPrefix = $rules['general_cost_prefix'] ?? 'GENERAL-';

        return $forecastData->flatMap(function ($item) use (
            $cashInCode,
            $wageCodes,
            $costItemDelaySplits,
            $oncostPrefixes,
            $oncostDelayMonths,
            $vendorCostPrefix,
            $revenueGstRate,
            $revenueDelayMonths,
            $generalCostPrefix
        ) {
            $costItem = $item->cost_item;
            $prefix = $this->getCostItemPrefix($costItem);
            $amount = (float) $item->forecast_amount;

            // Skip general costs - they're already processed
            if (str_starts_with($costItem, $generalCostPrefix)) {
                return [
                    (object) [
                        'month' => $item->month,
                        'cost_item' => $costItem,
                        'job_number' => $item->job_number,
                        'forecast_amount' => $amount,
                        'gst_rate' => $item->gst_rate ?? 0,
                        'is_general_cost' => true,
                    ],
                ];
            }

            // =================================================================
            // RULE 4: Revenue (99-99) - 10% GST + 2 month delay
            // =================================================================
            if ($costItem === $cashInCode) {
                $delayedMonth = Carbon::createFromFormat('Y-m', $item->month)
                    ->addMonths($revenueDelayMonths)
                    ->format('Y-m');

                return [
                    (object) [
                        'month' => $delayedMonth,
                        'cost_item' => $costItem,
                        'job_number' => $item->job_number,
                        'forecast_amount' => $amount * (1 + $revenueGstRate),
                        'gst_rate' => $revenueGstRate,
                    ],
                ];
            }

            // =================================================================
            // RULE 1: Wages (01-01, 03-01, 05-01, 07-01)
            // Split 70% wages (same month) / 30% tax (+1 month), NO GST
            // =================================================================
            if (in_array($costItem, $wageCodes) && isset($costItemDelaySplits[$costItem])) {
                return collect($costItemDelaySplits[$costItem])->map(function ($split) use ($item, $amount) {
                    $delayedMonth = Carbon::createFromFormat('Y-m', $item->month)
                        ->addMonths($split['delay'])
                        ->format('Y-m');

                    return (object) [
                        'month' => $delayedMonth,
                        'cost_item' => $item->cost_item,
                        'job_number' => $item->job_number,
                        'forecast_amount' => $amount * (float) $split['ratio'],
                        'gst_rate' => 0, // No GST on wages
                    ];
                });
            }

            // =================================================================
            // RULE 2: Oncosts (prefixes 02, 04, 06, 08) - +1 month delay, NO GST
            // =================================================================
            if (in_array($prefix, $oncostPrefixes)) {
                $delayedMonth = Carbon::createFromFormat('Y-m', $item->month)
                    ->addMonths($oncostDelayMonths)
                    ->format('Y-m');

                return [
                    (object) [
                        'month' => $delayedMonth,
                        'cost_item' => $costItem,
                        'job_number' => $item->job_number,
                        'forecast_amount' => $amount, // No GST multiplier
                        'gst_rate' => 0,
                    ],
                ];
            }

            // =================================================================
            // RULE 3: Vendor costs (prefixes 20-98) - 10% GST + 1 month delay
            // =================================================================
            if ($this->isPrefixInRange($prefix, $vendorCostPrefix['min'] ?? null, $vendorCostPrefix['max'] ?? null)) {
                $gstRate = $vendorCostPrefix['gst_rate'] ?? 0.10;
                $delayMonths = $vendorCostPrefix['delay_months'] ?? 1;

                $delayedMonth = Carbon::createFromFormat('Y-m', $item->month)
                    ->addMonths($delayMonths)
                    ->format('Y-m');

                return [
                    (object) [
                        'month' => $delayedMonth,
                        'cost_item' => $costItem,
                        'job_number' => $item->job_number,
                        'forecast_amount' => $amount * (1 + $gstRate),
                        'gst_rate' => $gstRate,
                    ],
                ];
            }

            // =================================================================
            // Default: No delay, no GST (other cost items)
            // =================================================================
            return [
                (object) [
                    'month' => $item->month,
                    'cost_item' => $costItem,
                    'job_number' => $item->job_number,
                    'forecast_amount' => $amount,
                    'gst_rate' => 0,
                ],
            ];
        });
    }

    private function buildMonthHierarchy(array $months, $forecastRows, array $costCodeDescriptions = [])
    {
        // Organize rows so the UI can render month -> cash in/out -> cost item -> job.
        $forecastByMonth = $forecastRows->groupBy('month');
        $cashInCode = $this->getForecastRules()['cash_in_code'] ?? '99-99';

        return collect($months)->map(function ($month) use ($forecastByMonth, $cashInCode, $costCodeDescriptions) {
            $monthItems = $forecastByMonth->get($month, collect());
            $cashInItems = $monthItems->filter(function ($item) use ($cashInCode) {
                return $item->cost_item === $cashInCode;
            });
            $cashOutItems = $monthItems->filter(function ($item) use ($cashInCode) {
                return $item->cost_item !== $cashInCode;
            });

            $cashInCostItems = $cashInItems
                ->groupBy('cost_item')
                ->map(function ($items, $costItem) use ($costCodeDescriptions) {
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
                        'description' => $costCodeDescriptions[$costItem] ?? null,
                        'total' => (float) $items->sum('forecast_amount'),
                        'jobs' => $jobs,
                    ];
                })
                ->sortBy('cost_item')
                ->values();

            $cashOutCostItems = $cashOutItems
                ->groupBy('cost_item')
                ->map(function ($items, $costItem) use ($costCodeDescriptions) {
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
                        'description' => $costCodeDescriptions[$costItem] ?? null,
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

    /**
     * RULE 5: Quarterly GST calculation
     * GST is calculated on CASH BASIS (after delays are applied).
     * Net GST (collected - paid) is due the month after quarter ends.
     * Q1 (Jan-Mar) -> paid in April
     * Q2 (Apr-Jun) -> paid in July
     * Q3 (Jul-Sep) -> paid in October
     * Q4 (Oct-Dec) -> paid in January
     */
    private function calculateQuarterlyGstPayable($forecastRows, array $rules)
    {
        $cashInCode = $rules['cash_in_code'] ?? '99-99';
        $gstPayableCode = $rules['gst_payable_code'] ?? 'GST-PAYABLE';

        // Group GST by month using the gst_rate attached to each row
        // This uses cash-method dates (delays already applied)
        $monthlyGst = $forecastRows->reduce(function ($carry, $row) use ($cashInCode) {
            // Use the gst_rate that was set during applyRules
            $gstRate = $row->gst_rate ?? 0;

            if ($gstRate <= 0) {
                return $carry;
            }

            // Extract GST component from the gross amount
            $gstAmount = $this->extractGstFromGross((float) $row->forecast_amount, (float) $gstRate);
            $monthKey = $row->month;

            if (!isset($carry[$monthKey])) {
                $carry[$monthKey] = ['collected' => 0.0, 'paid' => 0.0];
            }

            if ($row->cost_item === $cashInCode) {
                // GST collected from revenue
                $carry[$monthKey]['collected'] += $gstAmount;
            } else {
                // GST paid on costs
                $carry[$monthKey]['paid'] += $gstAmount;
            }

            return $carry;
        }, []);

        // Group monthly GST into quarters
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

        // Create GST payable rows for each quarter
        $rows = collect();
        foreach ($quarterBuckets as $bucket) {
            // Net GST = collected - paid
            // Positive = owe to ATO, Negative = refund from ATO
            $netGst = $bucket['collected'] - $bucket['paid'];

            if (abs($netGst) < 0.01) {
                continue;
            }

            // Net GST for the quarter is paid the month after quarter ends
            // Q1 ends March -> April, Q2 ends June -> July, etc.
            $payableMonth = Carbon::create($bucket['year'], $bucket['quarter'] * 3, 1)
                ->addMonth()
                ->format('Y-m');

            $rows->push((object) [
                'month' => $payableMonth,
                'cost_item' => $gstPayableCode,
                'job_number' => 'GST',
                'forecast_amount' => (float) $netGst,
                'gst_rate' => 0, // GST payable itself has no GST
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
