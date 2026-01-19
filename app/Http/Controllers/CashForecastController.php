<?php

namespace App\Http\Controllers;

use App\Models\ArProgressBillingSummary;
use App\Models\CashOutAdjustment;
use App\Models\CashInAdjustment;
use App\Models\CashForecastGeneralCost;
use App\Models\CashForecastSetting;
use App\Models\CostCode;
use App\Models\JobCostDetail;
use App\Models\JobForecastData;
use App\Models\VendorPaymentDelay;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class CashForecastController extends Controller
{
    public function __invoke(Request $request)
    {
        $rules = $this->getForecastRules();
        $currentMonth = Carbon::now()->format('Y-m');
        $rangeStart = Carbon::now()->subMonths(3)->startOfMonth();
        $rangeEnd = Carbon::now()->addMonths(12)->endOfMonth();

        $cashInAdjustments = $this->getCashInAdjustments($rangeStart, $rangeEnd);
        $rules['cash_in_adjustments'] = $cashInAdjustments['by_source'];
        $cashOutAdjustments = $this->getCashOutAdjustments($rangeStart, $rangeEnd);
        $rules['cash_out_adjustments'] = $cashOutAdjustments['by_source'];

        // Get settings (starting balance)
        $settings = CashForecastSetting::current();
        $rules['gst_pay_months'] = [
            1 => (int) ($settings->gst_q1_pay_month ?? 4),
            2 => (int) ($settings->gst_q2_pay_month ?? 8),
            3 => (int) ($settings->gst_q3_pay_month ?? 11),
            4 => (int) ($settings->gst_q4_pay_month ?? 2),
        ];

        // Get cost code descriptions for display
        $costCodeDescriptions = $this->getCostCodeDescriptions();
        $costTypeByCostItem = $this->getCostTypeByCostItem();

        // Get actuals from past months (costs and revenue)
        $actualData = $this->getActualData($rules);

        // Get forecast data for current month onwards (latest forecast per job)
        // NOTE: Forecast data does NOT have vendor information - only actuals have vendor breakdowns
        $cashInCode = $rules['cash_in_code'] ?? '99-99';
        $latestForecasts = $this->getLatestForecastsSubquery();
        $forecastData = JobForecastData::select(
            'job_forecast_data.month',
            'job_forecast_data.cost_item',
            'job_forecast_data.forecast_amount',
            'job_forecast_data.job_number',
            DB::raw("NULL as vendor"),
            DB::raw("'forecast' as source")
        )
            ->join('job_forecasts as jf', 'job_forecast_data.job_forecast_id', '=', 'jf.id')
            ->joinSub($latestForecasts, 'latest_forecasts', function ($join) {
                $join->on('jf.job_number', '=', 'latest_forecasts.job_number')
                    ->on('jf.forecast_month', '=', 'latest_forecasts.forecast_month');
            })
            ->where('job_forecast_data.month', '>=', $currentMonth)
            ->get();

        // For current month: calculate "remaining forecast" = forecast - actuals
        // This ensures we don't double-count when both actual invoices and forecasts exist
        $forecastData = $this->adjustCurrentMonthForecasts($forecastData, $actualData, $currentMonth, $cashInCode);

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

        $cashInSources = $this->getCashInSources($rules, $currentMonth, $rangeStart);
        $cashOutSources = $this->getCashOutSources($rules, $currentMonth, $rangeStart);
        $vendorPaymentDelays = $this->getVendorPaymentDelays($rangeStart, $rangeEnd);

        return Inertia::render('cash-forecast/show', [
            'months' => $allMonthsWithCostSummary,
            'currentMonth' => $currentMonth,
            'costCodeDescriptions' => $costCodeDescriptions,
            'costTypeByCostItem' => $costTypeByCostItem,
            'settings' => [
                'startingBalance' => (float) $settings->starting_balance,
                'startingBalanceDate' => $settings->starting_balance_date?->format('Y-m-d'),
                'gstQ1PayMonth' => (int) ($settings->gst_q1_pay_month ?? 4),
                'gstQ2PayMonth' => (int) ($settings->gst_q2_pay_month ?? 8),
                'gstQ3PayMonth' => (int) ($settings->gst_q3_pay_month ?? 11),
                'gstQ4PayMonth' => (int) ($settings->gst_q4_pay_month ?? 2),
            ],
            'generalCosts' => $generalCosts,
            'categories' => CashForecastGeneralCost::getCategories(),
            'frequencies' => CashForecastGeneralCost::getFrequencies(),
            'cashInSources' => $cashInSources,
            'cashInAdjustments' => $cashInAdjustments['list'],
            'cashOutSources' => $cashOutSources,
            'cashOutAdjustments' => $cashOutAdjustments['list'],
            'vendorPaymentDelays' => $vendorPaymentDelays,
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
            'gst_q1_pay_month' => 'required|integer|min:1|max:12',
            'gst_q2_pay_month' => 'required|integer|min:1|max:12',
            'gst_q3_pay_month' => 'required|integer|min:1|max:12',
            'gst_q4_pay_month' => 'required|integer|min:1|max:12',
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
            'flow_type' => 'required|in:cash_in,cash_out',
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
            'flow_type' => 'required|in:cash_in,cash_out',
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
     * Store cash-in adjustments for a job + source month.
     */
    public function storeCashInAdjustments(Request $request)
    {
        $validated = $request->validate([
            'job_number' => 'required|string',
            'source_month' => 'required|date_format:Y-m',
            'splits' => 'nullable|array',
            'splits.*.receipt_month' => 'required_with:splits|date_format:Y-m',
            'splits.*.amount' => 'required_with:splits|numeric|min:0',
        ]);

        $jobNumber = $validated['job_number'];
        $sourceMonth = Carbon::createFromFormat('Y-m', $validated['source_month'])->startOfMonth();
        $splits = collect($validated['splits'] ?? []);

        $sourceAmount = $this->getCashInSourceAmount($jobNumber, $sourceMonth);
        if ($sourceAmount === null) {
            return back()->withErrors(['source_month' => 'No billed amount found for this job/month.']);
        }

        $splitTotal = $splits->sum('amount');
        if ($splitTotal - $sourceAmount > 0.01) {
            return back()->withErrors(['splits' => 'Split total cannot exceed billed amount.']);
        }

        DB::transaction(function () use ($jobNumber, $sourceMonth, $splits) {
            CashInAdjustment::where('job_number', $jobNumber)
                ->whereDate('source_month', $sourceMonth)
                ->delete();

            if ($splits->isEmpty()) {
                return;
            }

            $rows = $splits
                ->filter(fn ($split) => (float) $split['amount'] > 0)
                ->map(function ($split) use ($jobNumber, $sourceMonth) {
                    return [
                        'job_number' => $jobNumber,
                        'source_month' => $sourceMonth->copy(),
                        'receipt_month' => Carbon::createFromFormat('Y-m', $split['receipt_month'])->startOfMonth(),
                        'amount' => (float) $split['amount'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                })
                ->all();

            if (!empty($rows)) {
                CashInAdjustment::insert($rows);
            }
        });

        return back()->with('success', 'Cash-in adjustments saved successfully.');
    }

    /**
     * Store cash-out adjustments for a job + cost item + vendor + source month.
     */
    public function storeCashOutAdjustments(Request $request)
    {
        $validated = $request->validate([
            'job_number' => 'nullable|string',
            'cost_item' => 'required|string',
            'vendor' => 'nullable|string',
            'source_month' => 'required|date_format:Y-m',
            'splits' => 'nullable|array',
            'splits.*.payment_month' => 'required_with:splits|date_format:Y-m',
            'splits.*.amount' => 'required_with:splits|numeric|min:0',
        ]);

        $jobNumber = $validated['job_number'] ?? 'ALL';
        $costItem = $validated['cost_item'];
        $vendor = $validated['vendor'] ?? null;
        $sourceMonth = Carbon::createFromFormat('Y-m', $validated['source_month'])->startOfMonth();
        $splits = collect($validated['splits'] ?? []);

        $sourceAmount = $this->getCashOutSourceAmount($jobNumber, $costItem, $vendor, $sourceMonth);
        if ($sourceAmount === null) {
            return back()->withErrors(['source_month' => 'No source amount found for this job/cost item/month.']);
        }

        $splitTotal = $splits->sum('amount');
        if ($splitTotal - $sourceAmount > 0.01) {
            return back()->withErrors(['splits' => 'Split total cannot exceed source amount.']);
        }

        DB::transaction(function () use ($jobNumber, $costItem, $vendor, $sourceMonth, $splits) {
            CashOutAdjustment::where('job_number', $jobNumber)
                ->where('cost_item', $costItem)
                ->where('vendor', $vendor)
                ->whereDate('source_month', $sourceMonth)
                ->delete();

            if ($splits->isEmpty()) {
                return;
            }

            $rows = $splits
                ->filter(fn ($split) => (float) $split['amount'] > 0)
                ->map(function ($split) use ($jobNumber, $costItem, $vendor, $sourceMonth) {
                    return [
                        'job_number' => $jobNumber,
                        'cost_item' => $costItem,
                        'vendor' => $vendor,
                        'source_month' => $sourceMonth->copy(),
                        'payment_month' => Carbon::createFromFormat('Y-m', $split['payment_month'])->startOfMonth(),
                        'amount' => (float) $split['amount'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                })
                ->all();

            if (!empty($rows)) {
                CashOutAdjustment::insert($rows);
            }
        });

        return back()->with('success', 'Cash-out adjustments saved successfully.');
    }

    /**
     * Store vendor payment delays for a vendor + source month.
     */
    public function storeVendorPaymentDelays(Request $request)
    {
        $validated = $request->validate([
            'vendor' => 'required|string',
            'source_month' => 'required|date_format:Y-m',
            'splits' => 'nullable|array',
            'splits.*.payment_month' => 'required_with:splits|date_format:Y-m',
            'splits.*.amount' => 'required_with:splits|numeric|min:0',
        ]);

        $vendor = $validated['vendor'];
        $sourceMonth = Carbon::createFromFormat('Y-m', $validated['source_month'])->startOfMonth();
        $splits = collect($validated['splits'] ?? []);

        DB::transaction(function () use ($vendor, $sourceMonth, $splits) {
            VendorPaymentDelay::where('vendor', $vendor)
                ->whereDate('source_month', $sourceMonth)
                ->delete();

            if ($splits->isEmpty()) {
                return;
            }

            $rows = $splits
                ->filter(fn($split) => (float) $split['amount'] > 0)
                ->map(function ($split) use ($vendor, $sourceMonth) {
                    return [
                        'vendor' => $vendor,
                        'source_month' => $sourceMonth->copy(),
                        'payment_month' => Carbon::createFromFormat('Y-m', $split['payment_month'])->startOfMonth(),
                        'amount' => (float) $split['amount'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                })
                ->all();

            if (!empty($rows)) {
                VendorPaymentDelay::insert($rows);
            }
        });

        return back()->with('success', 'Vendor payment delays saved successfully.');
    }

    /**
     * Show unmapped job cost items within a month range.
     */
    public function unmappedTransactions(Request $request)
    {
        $rules = $this->getForecastRules();
        $cashInCode = $rules['cash_in_code'] ?? '99-99';

        $startMonth = $this->resolveMonthInput($request->query('start_month')) ?? Carbon::now()->startOfMonth();
        $endMonth = $this->resolveMonthInput($request->query('end_month')) ?? Carbon::now()->addMonths(12)->startOfMonth();

        if ($startMonth->gt($endMonth)) {
            [$startMonth, $endMonth] = [$endMonth, $startMonth];
        }

        $months = $this->generateMonthRangeByEnd($startMonth, $endMonth);

        $monthExpression = $this->getMonthExpression('job_cost_details.transaction_date');
        $actualRows = JobCostDetail::query()
            ->leftJoin('cost_codes', 'job_cost_details.cost_item', '=', 'cost_codes.code')
            ->whereNull('cost_codes.cost_type_id')
            ->where('job_cost_details.cost_item', '!=', $cashInCode)
            ->where('job_cost_details.cost_item', 'not like', 'GENERAL-%')
            ->whereBetween('job_cost_details.transaction_date', [
                $startMonth->copy()->startOfMonth(),
                $endMonth->copy()->endOfMonth(),
            ])
            ->groupBy(
                'job_cost_details.job_number',
                'job_cost_details.cost_item',
                DB::raw($monthExpression),
                'cost_codes.description'
            )
            ->select(
                'job_cost_details.job_number',
                'job_cost_details.cost_item',
                DB::raw($monthExpression . ' as month'),
                DB::raw('SUM(job_cost_details.amount) as amount'),
                'cost_codes.description as description'
            )
            ->get()
            ->map(function ($row) {
                return [
                    'job_number' => $row->job_number,
                    'cost_item' => $row->cost_item,
                    'description' => $row->description,
                    'month' => $row->month,
                    'amount' => (float) $row->amount,
                    'source' => 'actual',
                ];
            });

        $latestForecasts = $this->getLatestForecastsSubquery();
        $forecastRows = JobForecastData::query()
            ->leftJoin('cost_codes', 'job_forecast_data.cost_item', '=', 'cost_codes.code')
            ->join('job_forecasts as jf', 'job_forecast_data.job_forecast_id', '=', 'jf.id')
            ->joinSub($latestForecasts, 'latest_forecasts', function ($join) {
                $join->on('jf.job_number', '=', 'latest_forecasts.job_number')
                    ->on('jf.forecast_month', '=', 'latest_forecasts.forecast_month');
            })
            ->whereNull('cost_codes.cost_type_id')
            ->where('job_forecast_data.cost_item', '!=', $cashInCode)
            ->where('job_forecast_data.cost_item', 'not like', 'GENERAL-%')
            ->whereBetween('job_forecast_data.month', [$startMonth->format('Y-m'), $endMonth->format('Y-m')])
            ->groupBy('job_forecast_data.job_number', 'job_forecast_data.cost_item', 'job_forecast_data.month', 'cost_codes.description')
            ->select(
                'job_forecast_data.job_number',
                'job_forecast_data.cost_item',
                'job_forecast_data.month',
                DB::raw('SUM(job_forecast_data.forecast_amount) as amount'),
                'cost_codes.description as description'
            )
            ->get()
            ->map(function ($row) {
                return [
                    'job_number' => $row->job_number,
                    'cost_item' => $row->cost_item,
                    'description' => $row->description,
                    'month' => $row->month,
                    'amount' => (float) $row->amount,
                    'source' => 'forecast',
                ];
            });

        $rows = $actualRows
            ->concat($forecastRows)
            ->sortBy(['month', 'job_number', 'cost_item'])
            ->values();

        return Inertia::render('cash-forecast/unmapped', [
            'rows' => $rows,
            'months' => $months,
            'startMonth' => $startMonth->format('Y-m'),
            'endMonth' => $endMonth->format('Y-m'),
        ]);
    }

    /**
     * Get cost code descriptions from the database.
     */
    private function getCostCodeDescriptions(): array
    {
        return CostCode::pluck('description', 'code')->toArray();
    }

    private function getCostTypeByCostItem(): array
    {
        return CostCode::with('costType')
            ->get()
            ->mapWithKeys(function (CostCode $costCode) {
                return [$costCode->code => $costCode->costType?->code];
            })
            ->toArray();
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
                    'source_month' => $month,
                    'cost_item' => 'GENERAL-' . strtoupper($cost->category ?? 'OTHER'),
                    'job_number' => $cost->name,
                    'vendor' => null,
                    'forecast_amount' => $amount,
                    'gst_rate' => $cost->includes_gst ? 0.10 : 0,
                    'is_general_cost' => true,
                    'flow_type' => $cost->flow_type ?? 'cash_out',
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
        $costActuals = JobCostDetail::select('job_number', 'cost_item', 'transaction_date', 'amount', 'vendor')
            ->where('transaction_date', '>=', Carbon::now()->subMonths(3)->startOfMonth())
            ->get()
            ->map(function ($item) {
                return (object) [
                    'job_number' => $item->job_number,
                    'cost_item' => $item->cost_item,
                    'month' => Carbon::parse($item->transaction_date)->format('Y-m'),
                    'forecast_amount' => (float) $item->amount,
                    'vendor' => $item->vendor ?: 'GL',
                    'is_actual' => true,
                    'source' => 'actual',
                ];
            });

        // Get revenue actuals (use amount_payable_this_application which is after retention)
        $revenueActuals = ArProgressBillingSummary::select('job_number', 'period_end_date', 'amount_payable_this_application')
            ->where('period_end_date', '>=', Carbon::now()->subMonths(3)->startOfMonth())
            ->get()
            ->map(function ($item) use ($cashInCode) {
                return (object) [
                    'job_number' => $item->job_number,
                    'cost_item' => $cashInCode,
                    'month' => Carbon::parse($item->period_end_date)->format('Y-m'),
                    'forecast_amount' => (float) $item->amount_payable_this_application,
                    'vendor' => null,
                    'is_actual' => true,
                    'source' => 'actual',
                ];
            });

        return $costActuals->concat($revenueActuals);
    }

    /**
     * Adjust forecast data for current month by subtracting actuals.
     *
     * For the current month, we have both:
     * - Actuals: invoices already received/processed (with vendor breakdown)
     * - Forecasts: total expected for the month
     *
     * To avoid double-counting, we calculate "remaining forecast" = forecast - actuals
     * at the job+cost_item level. If remaining is positive, it represents expected
     * costs still to come. If zero or negative, the forecast is fully covered by actuals.
     */
    private function adjustCurrentMonthForecasts(
        \Illuminate\Support\Collection $forecastData,
        \Illuminate\Support\Collection $actualData,
        string $currentMonth,
        string $cashInCode
    ): \Illuminate\Support\Collection {
        // Calculate actual totals for current month by job+cost_item
        $currentMonthActualTotals = $actualData
            ->filter(fn($item) => $item->month === $currentMonth)
            ->groupBy(fn($item) => $item->job_number . '|' . $item->cost_item)
            ->map(fn($items) => $items->sum('forecast_amount'));

        return $forecastData->map(function ($item) use ($currentMonth, $currentMonthActualTotals, $cashInCode) {
            // Only adjust current month forecasts
            if ($item->month !== $currentMonth) {
                return $item;
            }

            $key = $item->job_number . '|' . $item->cost_item;
            $actualTotal = $currentMonthActualTotals->get($key, 0);

            // Calculate remaining forecast (what's still expected to come)
            $remainingForecast = (float) $item->forecast_amount - $actualTotal;

            // If remaining is zero or negative, the forecast is fully covered by actuals
            // Return null to filter out, or return with zero amount
            if ($remainingForecast <= 0) {
                return null;
            }

            // Return adjusted forecast with remaining amount
            return (object) [
                'month' => $item->month,
                'cost_item' => $item->cost_item,
                'forecast_amount' => $remainingForecast,
                'job_number' => $item->job_number,
                'vendor' => null,
                'source' => 'forecast',
            ];
        })->filter(); // Remove null entries
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

    private function getLatestForecastsSubquery()
    {
        return \App\Models\JobForecast::query()
            ->select('job_number', DB::raw('MAX(forecast_month) as forecast_month'))
            ->groupBy('job_number');
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

    private function generateMonthRangeByEnd(Carbon $start, Carbon $end): array
    {
        $months = [];
        $period = $start->copy()->startOfMonth();
        $endMonth = $end->copy()->startOfMonth();

        while ($period->format('Y-m') <= $endMonth->format('Y-m')) {
            $months[] = $period->format('Y-m');
            $period->addMonth();
        }

        return $months;
    }

    private function resolveMonthInput(?string $input): ?Carbon
    {
        if (!$input) {
            return null;
        }

        $parsed = Carbon::createFromFormat('Y-m', $input);
        if ($parsed && $parsed->format('Y-m') === $input) {
            return $parsed->startOfMonth();
        }

        return null;
    }

    private function getMonthExpression(string $column): string
    {
        if (DB::getDriverName() === 'sqlite') {
            return "strftime('%Y-%m', {$column})";
        }

        return "DATE_FORMAT({$column}, '%Y-%m')";
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
        $cashInAdjustments = $rules['cash_in_adjustments'] ?? [];
        $cashOutAdjustments = $rules['cash_out_adjustments'] ?? [];

        $vendorTotals = $forecastData->reduce(function ($carry, $item) use ($cashInCode, $generalCostPrefix) {
            if ($item->cost_item === $cashInCode) {
                return $carry;
            }
            if (str_starts_with($item->cost_item, $generalCostPrefix)) {
                return $carry;
            }
            if (($item->source ?? null) !== 'actual') {
                return $carry;
            }
            $vendorKey = $item->vendor ?: 'GL';
            $key = $vendorKey . '|' . $item->cost_item . '|' . $item->month;
            $carry[$key] = ($carry[$key] ?? 0) + (float) $item->forecast_amount;

            return $carry;
        }, []);

        return $forecastData->flatMap(function ($item) use (
            $cashInCode,
            $wageCodes,
            $costItemDelaySplits,
            $oncostPrefixes,
            $oncostDelayMonths,
            $vendorCostPrefix,
            $revenueGstRate,
            $revenueDelayMonths,
            $generalCostPrefix,
            $cashInAdjustments,
            $cashOutAdjustments,
            $vendorTotals
        ) {
            $costItem = $item->cost_item;
            $prefix = $this->getCostItemPrefix($costItem);
            $amount = (float) $item->forecast_amount;
            $vendor = $item->vendor ?? null;

            // Skip general costs - they're already processed
            if (str_starts_with($costItem, $generalCostPrefix)) {
                return [
                    (object) [
                        'month' => $item->month,
                        'source_month' => $item->month,
                        'cost_item' => $costItem,
                        'job_number' => $item->job_number,
                        'vendor' => $vendor,
                        'forecast_amount' => $amount,
                        'gst_rate' => $item->gst_rate ?? 0,
                        'is_general_cost' => true,
                        'flow_type' => $item->flow_type ?? null,
                        'source' => $item->source ?? null,
                    ],
                ];
            }

            // =================================================================
            // RULE 4: Revenue (99-99) - 10% GST + 2 month delay
            // =================================================================
            if ($costItem === $cashInCode) {
                $adjustmentKey = $item->job_number . '|' . $item->month;
                $adjustments = $cashInAdjustments[$adjustmentKey] ?? null;

                if (!empty($adjustments)) {
                    $adjustedTotal = collect($adjustments)->sum('amount');
                    $rows = collect($adjustments)->map(function ($adjustment) use ($item, $revenueGstRate) {
                        return (object) [
                            'month' => $adjustment['receipt_month'],
                            'source_month' => $item->month,
                            'cost_item' => $item->cost_item,
                            'job_number' => $item->job_number,
                            'vendor' => $item->vendor ?? null,
                            'forecast_amount' => (float) $adjustment['amount'] * (1 + $revenueGstRate),
                            'gst_rate' => $revenueGstRate,
                            'source' => $item->source ?? null,
                        ];
                    });

                    $remaining = $amount - $adjustedTotal;
                    if ($remaining > 0.01) {
                        $delayedMonth = Carbon::createFromFormat('Y-m', $item->month)
                            ->addMonths($revenueDelayMonths)
                            ->format('Y-m');

                        $rows->push((object) [
                            'month' => $delayedMonth,
                            'source_month' => $item->month,
                            'cost_item' => $costItem,
                            'job_number' => $item->job_number,
                            'vendor' => $item->vendor ?? null,
                            'forecast_amount' => $remaining * (1 + $revenueGstRate),
                            'gst_rate' => $revenueGstRate,
                            'source' => $item->source ?? null,
                        ]);
                    }

                    return $rows;
                }

                $delayedMonth = Carbon::createFromFormat('Y-m', $item->month)
                    ->addMonths($revenueDelayMonths)
                    ->format('Y-m');

                return [
                    (object) [
                        'month' => $delayedMonth,
                        'source_month' => $item->month,
                        'cost_item' => $costItem,
                        'job_number' => $item->job_number,
                        'vendor' => $item->vendor ?? null,
                        'forecast_amount' => $amount * (1 + $revenueGstRate),
                        'gst_rate' => $revenueGstRate,
                        'source' => $item->source ?? null,
                    ],
                ];
            }

            $vendorKey = $vendor ?: 'GL';
            $adjustmentKey = $item->job_number . '|' . $costItem . '|' . $vendorKey . '|' . $item->month;
            $vendorAdjustmentKey = 'ALL' . '|' . $costItem . '|' . $vendorKey . '|' . $item->month;
            $adjustments = $cashOutAdjustments[$adjustmentKey] ?? null;
            $adjustmentRows = collect();
            $hasAdjustments = false;
            $isVendorLevel = false;
            if (empty($adjustments)) {
                $adjustments = $cashOutAdjustments[$vendorAdjustmentKey] ?? null;
                $isVendorLevel = !empty($adjustments);
            }

            if (!empty($adjustments)) {
                if ($isVendorLevel && ($item->source ?? null) !== 'actual') {
                    $adjustments = null;
                }
            }

            if (!empty($adjustments)) {
                $gstRate = 0;
                if ($this->isPrefixInRange($prefix, $vendorCostPrefix['min'] ?? null, $vendorCostPrefix['max'] ?? null)) {
                    $gstRate = $vendorCostPrefix['gst_rate'] ?? 0.10;
                }

                $vendorTotalKey = $vendorKey . '|' . $costItem . '|' . $item->month;
                $vendorTotal = (float) ($vendorTotals[$vendorTotalKey] ?? 0);
                $portion = ($isVendorLevel && $vendorTotal > 0) ? min(1, $amount / $vendorTotal) : 1;

                $adjustedTotal = collect($adjustments)->sum('amount') * $portion;
                $adjustmentRows = collect($adjustments)->map(function ($adjustment) use ($item, $gstRate, $portion) {
                    return (object) [
                        'month' => $adjustment['payment_month'],
                        'source_month' => $item->month,
                        'cost_item' => $item->cost_item,
                        'job_number' => $item->job_number,
                        'vendor' => $item->vendor ?? null,
                        'forecast_amount' => (float) $adjustment['amount'] * $portion * (1 + $gstRate),
                        'gst_rate' => $gstRate,
                        'source' => $item->source ?? null,
                    ];
                });

                $remaining = $amount - $adjustedTotal;
                if ($remaining <= 0.01) {
                    return $adjustmentRows;
                }

                $amount = $remaining;
                $hasAdjustments = true;
            }

            // =================================================================
            // RULE 1: Wages (01-01, 03-01, 05-01, 07-01)
            // Split 70% wages (same month) / 30% tax (+1 month), NO GST
            // =================================================================
            if (in_array($costItem, $wageCodes) && isset($costItemDelaySplits[$costItem])) {
                $rows = collect($costItemDelaySplits[$costItem])->map(function ($split) use ($item, $amount) {
                    $delayedMonth = Carbon::createFromFormat('Y-m', $item->month)
                        ->addMonths($split['delay'])
                        ->format('Y-m');

                    return (object) [
                        'month' => $delayedMonth,
                        'source_month' => $item->month,
                        'cost_item' => $item->cost_item,
                        'job_number' => $item->job_number,
                        'vendor' => $item->vendor ?? null,
                        'forecast_amount' => $amount * (float) $split['ratio'],
                        'gst_rate' => 0, // No GST on wages
                        'source' => $item->source ?? null,
                    ];
                });

                return $hasAdjustments ? $adjustmentRows->concat($rows) : $rows;
            }

            // =================================================================
            // RULE 2: Oncosts (prefixes 02, 04, 06, 08) - +1 month delay, NO GST
            // =================================================================
            if (in_array($prefix, $oncostPrefixes)) {
                $delayedMonth = Carbon::createFromFormat('Y-m', $item->month)
                    ->addMonths($oncostDelayMonths)
                    ->format('Y-m');

                $rows = collect([
                    (object) [
                        'month' => $delayedMonth,
                        'source_month' => $item->month,
                        'cost_item' => $costItem,
                        'job_number' => $item->job_number,
                        'vendor' => $item->vendor ?? null,
                        'forecast_amount' => $amount, // No GST multiplier
                        'gst_rate' => 0,
                        'source' => $item->source ?? null,
                    ],
                ]);

                return $hasAdjustments ? $adjustmentRows->concat($rows) : $rows;
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

                $rows = collect([
                    (object) [
                        'month' => $delayedMonth,
                        'source_month' => $item->month,
                        'cost_item' => $costItem,
                        'job_number' => $item->job_number,
                        'vendor' => $item->vendor ?? null,
                        'forecast_amount' => $amount * (1 + $gstRate),
                        'gst_rate' => $gstRate,
                        'source' => $item->source ?? null,
                    ],
                ]);

                return $hasAdjustments ? $adjustmentRows->concat($rows) : $rows;
            }

            // =================================================================
            // Default: No delay, no GST (other cost items)
            // =================================================================
            $rows = collect([
                (object) [
                    'month' => $item->month,
                    'source_month' => $item->month,
                    'cost_item' => $costItem,
                    'job_number' => $item->job_number,
                    'vendor' => $item->vendor ?? null,
                    'forecast_amount' => $amount,
                    'gst_rate' => 0,
                    'source' => $item->source ?? null,
                ],
            ]);

            return $hasAdjustments ? $adjustmentRows->concat($rows) : $rows;
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
                return ($item->flow_type ?? null) === 'cash_in' || $item->cost_item === $cashInCode;
            });
            $cashOutItems = $monthItems->filter(function ($item) use ($cashInCode) {
                return !((($item->flow_type ?? null) === 'cash_in') || $item->cost_item === $cashInCode);
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
                    // Vendors from ACTUAL data only (real vendor breakdown from invoices)
                    $actualVendors = $items
                        ->filter(function ($vendorItem) {
                            return ($vendorItem->source ?? null) === 'actual';
                        })
                        ->groupBy(function ($vendorItem) {
                            return $vendorItem->vendor ?? 'GL';
                        })
                        ->map(function ($vendorItems, $vendorName) {
                            $jobs = $vendorItems
                                ->groupBy('job_number')
                                ->map(function ($jobItems, $jobNumber) {
                                    return [
                                        'job_number' => $jobNumber,
                                        'total' => (float) $jobItems->sum('forecast_amount'),
                                    ];
                                })
                                ->values();

                            return [
                                'vendor' => $vendorName,
                                'total' => (float) $vendorItems->sum('forecast_amount'),
                                'jobs' => $jobs,
                                'source' => 'actual',
                            ];
                        })
                        ->values();

                    // FORECAST data as a separate pseudo-vendor "Remaining Forecast"
                    // This represents expected costs still to come (no vendor breakdown available)
                    $forecastItems = $items->filter(function ($item) {
                        return ($item->source ?? null) === 'forecast';
                    });

                    $forecastVendor = collect();
                    if ($forecastItems->isNotEmpty()) {
                        $forecastJobs = $forecastItems
                            ->groupBy('job_number')
                            ->map(function ($jobItems, $jobNumber) {
                                return [
                                    'job_number' => $jobNumber,
                                    'total' => (float) $jobItems->sum('forecast_amount'),
                                ];
                            })
                            ->values();

                        $forecastVendor = collect([[
                            'vendor' => 'Remaining Forecast',
                            'total' => (float) $forecastItems->sum('forecast_amount'),
                            'jobs' => $forecastJobs,
                            'source' => 'forecast',
                        ]]);
                    }

                    // Combine actual vendors + forecast pseudo-vendor
                    $vendors = $actualVendors->concat($forecastVendor)->values();

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
                        'vendors' => $vendors,
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
            $monthKey = $row->source_month ?? $row->month;

            if (!isset($carry[$monthKey])) {
                $carry[$monthKey] = ['collected' => 0.0, 'paid' => 0.0];
            }

            if (($row->flow_type ?? null) === 'cash_in' || $row->cost_item === $cashInCode) {
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
        $payMonths = $rules['gst_pay_months'] ?? [];

        foreach ($quarterBuckets as $bucket) {
            // Net GST = collected - paid
            // Positive = owe to ATO, Negative = refund from ATO
            $netGst = $bucket['collected'] - $bucket['paid'];

            if (abs($netGst) < 0.01) {
                continue;
            }

            $quarter = (int) $bucket['quarter'];
            $quarterEndMonth = $quarter * 3;
            $payMonth = (int) ($payMonths[$quarter] ?? ($quarterEndMonth + 1));
            if ($payMonth > 12) {
                $payMonth -= 12;
            }
            $payYear = $bucket['year'];
            if ($payMonth <= $quarterEndMonth) {
                $payYear += 1;
            }
            $payableMonth = Carbon::create($payYear, $payMonth, 1)->format('Y-m');

            $rows->push((object) [
                'month' => $payableMonth,
                'source_month' => $payableMonth,
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

    private function getCashInAdjustments(Carbon $startMonth, Carbon $endMonth): array
    {
        $list = CashInAdjustment::query()
            ->whereBetween('source_month', [$startMonth, $endMonth])
            ->orderBy('job_number')
            ->orderBy('source_month')
            ->orderBy('receipt_month')
            ->get()
            ->map(function (CashInAdjustment $adjustment) {
                return [
                    'id' => $adjustment->id,
                    'job_number' => $adjustment->job_number,
                    'source_month' => Carbon::parse($adjustment->source_month)->format('Y-m'),
                    'receipt_month' => Carbon::parse($adjustment->receipt_month)->format('Y-m'),
                    'amount' => (float) $adjustment->amount,
                ];
            })
            ->values();

        $bySource = $list
            ->groupBy(fn ($adjustment) => $adjustment['job_number'] . '|' . $adjustment['source_month'])
            ->map(fn ($items) => $items->values()->all())
            ->all();

        return [
            'list' => $list->all(),
            'by_source' => $bySource,
        ];
    }

    private function getCashOutAdjustments(Carbon $startMonth, Carbon $endMonth): array
    {
        $list = CashOutAdjustment::query()
            ->whereBetween('source_month', [$startMonth, $endMonth])
            ->orderBy('job_number')
            ->orderBy('cost_item')
            ->orderBy('vendor')
            ->orderBy('source_month')
            ->orderBy('payment_month')
            ->get()
            ->map(function (CashOutAdjustment $adjustment) {
                return [
                    'id' => $adjustment->id,
                    'job_number' => $adjustment->job_number,
                    'cost_item' => $adjustment->cost_item,
                    'vendor' => $adjustment->vendor ?? 'GL',
                    'source_month' => Carbon::parse($adjustment->source_month)->format('Y-m'),
                    'payment_month' => Carbon::parse($adjustment->payment_month)->format('Y-m'),
                    'amount' => (float) $adjustment->amount,
                ];
            })
            ->values();

        $bySource = $list
            ->groupBy(fn ($adjustment) => $adjustment['job_number'] . '|' . $adjustment['cost_item'] . '|' . ($adjustment['vendor'] ?? 'GL') . '|' . $adjustment['source_month'])
            ->map(fn ($items) => $items->values()->all())
            ->all();

        return [
            'list' => $list->all(),
            'by_source' => $bySource,
        ];
    }

    private function getVendorPaymentDelays(Carbon $startMonth, Carbon $endMonth): array
    {
        return VendorPaymentDelay::query()
            ->whereBetween('source_month', [$startMonth, $endMonth])
            ->orderBy('vendor')
            ->orderBy('source_month')
            ->orderBy('payment_month')
            ->get()
            ->map(function (VendorPaymentDelay $delay) {
                return [
                    'id' => $delay->id,
                    'vendor' => $delay->vendor,
                    'source_month' => Carbon::parse($delay->source_month)->format('Y-m'),
                    'payment_month' => Carbon::parse($delay->payment_month)->format('Y-m'),
                    'amount' => (float) $delay->amount,
                ];
            })
            ->values()
            ->all();
    }

    private function getCashInSources(array $rules, string $currentMonth, Carbon $startMonth): array
    {
        $cashInCode = $rules['cash_in_code'] ?? '99-99';

        // Use amount_payable_this_application which is after retention
        $actuals = ArProgressBillingSummary::select('job_number', 'period_end_date', 'amount_payable_this_application')
            ->where('period_end_date', '>=', $startMonth)
            ->get()
            ->groupBy(function ($item) {
                $month = Carbon::parse($item->period_end_date)->format('Y-m');
                return $item->job_number . '|' . $month;
            })
            ->map(function ($items, $key) {
                [$jobNumber, $month] = explode('|', $key, 2);
                return [
                    'job_number' => $jobNumber,
                    'month' => $month,
                    'amount' => (float) $items->sum('amount_payable_this_application'),
                    'source' => 'actual',
                ];
            })
            ->values();

        // Calculate actual totals for current month by job (for remaining forecast calculation)
        $currentMonthActualTotals = $actuals
            ->filter(fn($item) => $item['month'] === $currentMonth)
            ->groupBy('job_number')
            ->map(fn($items) => $items->sum('amount'));

        // For current month, we calculate "remaining forecast" = forecast - actuals
        $latestForecasts = $this->getLatestForecastsSubquery();
        $forecasts = JobForecastData::select(
            'job_forecast_data.month',
            'job_forecast_data.job_number',
            DB::raw('SUM(job_forecast_data.forecast_amount) as amount')
        )
            ->join('job_forecasts as jf', 'job_forecast_data.job_forecast_id', '=', 'jf.id')
            ->joinSub($latestForecasts, 'latest_forecasts', function ($join) {
                $join->on('jf.job_number', '=', 'latest_forecasts.job_number')
                    ->on('jf.forecast_month', '=', 'latest_forecasts.forecast_month');
            })
            ->where('job_forecast_data.month', '>=', $currentMonth)
            ->where('job_forecast_data.cost_item', $cashInCode)
            ->groupBy('job_forecast_data.month', 'job_forecast_data.job_number')
            ->get()
            ->map(function ($row) use ($currentMonth, $currentMonthActualTotals) {
                $amount = (float) $row->amount;

                // For current month, subtract actuals to get "remaining forecast"
                if ($row->month === $currentMonth) {
                    $actualTotal = $currentMonthActualTotals->get($row->job_number, 0);
                    $amount = $amount - $actualTotal;

                    // If remaining is zero or negative, skip this forecast entry
                    if ($amount <= 0) {
                        return null;
                    }
                }

                return [
                    'job_number' => $row->job_number,
                    'month' => $row->month,
                    'amount' => $amount,
                    'source' => 'forecast',
                ];
            })
            ->filter(); // Remove null entries

        return $actuals->concat($forecasts)->values()->all();
    }

    private function getCashOutSources(array $rules, string $currentMonth, Carbon $startMonth): array
    {
        $cashInCode = $rules['cash_in_code'] ?? '99-99';

        $actuals = JobCostDetail::select('job_number', 'cost_item', 'transaction_date', 'amount', 'vendor')
            ->where('transaction_date', '>=', $startMonth)
            ->where('cost_item', '!=', $cashInCode)
            ->where('cost_item', '!=', 'GST-PAYABLE')
            ->where('cost_item', 'not like', 'GENERAL-%')
            ->get()
            ->map(function ($item) {
                return [
                    'job_number' => $item->job_number,
                    'cost_item' => $item->cost_item,
                    'vendor' => $item->vendor ?: 'GL',
                    'month' => Carbon::parse($item->transaction_date)->format('Y-m'),
                    'amount' => (float) $item->amount,
                    'source' => 'actual',
                ];
            });

        // Calculate actual totals for current month by job+cost_item (for remaining forecast calculation)
        $currentMonthActualTotals = $actuals
            ->filter(fn($item) => $item['month'] === $currentMonth)
            ->groupBy(fn($item) => $item['job_number'] . '|' . $item['cost_item'])
            ->map(fn($items) => $items->sum('amount'));

        // NOTE: Forecast data does NOT have vendor - only actuals have vendor breakdowns
        // For current month, we calculate "remaining forecast" = forecast - actuals
        $latestForecasts = $this->getLatestForecastsSubquery();
        $forecasts = JobForecastData::select(
            'job_forecast_data.month',
            'job_forecast_data.cost_item',
            'job_forecast_data.job_number',
            DB::raw('SUM(job_forecast_data.forecast_amount) as amount')
        )
            ->join('job_forecasts as jf', 'job_forecast_data.job_forecast_id', '=', 'jf.id')
            ->joinSub($latestForecasts, 'latest_forecasts', function ($join) {
                $join->on('jf.job_number', '=', 'latest_forecasts.job_number')
                    ->on('jf.forecast_month', '=', 'latest_forecasts.forecast_month');
            })
            ->where('job_forecast_data.month', '>=', $currentMonth)
            ->where('job_forecast_data.cost_item', '!=', $cashInCode)
            ->where('job_forecast_data.cost_item', '!=', 'GST-PAYABLE')
            ->where('job_forecast_data.cost_item', 'not like', 'GENERAL-%')
            ->groupBy('job_forecast_data.month', 'job_forecast_data.cost_item', 'job_forecast_data.job_number')
            ->get()
            ->map(function ($row) use ($currentMonth, $currentMonthActualTotals) {
                $amount = (float) $row->amount;

                // For current month, subtract actuals to get "remaining forecast"
                if ($row->month === $currentMonth) {
                    $key = $row->job_number . '|' . $row->cost_item;
                    $actualTotal = $currentMonthActualTotals->get($key, 0);
                    $amount = $amount - $actualTotal;

                    // If remaining is zero or negative, skip this forecast entry
                    if ($amount <= 0) {
                        return null;
                    }
                }

                return [
                    'job_number' => $row->job_number,
                    'cost_item' => $row->cost_item,
                    'vendor' => null,  // Forecast data has no vendor
                    'month' => $row->month,
                    'amount' => $amount,
                    'source' => 'forecast',
                ];
            })
            ->filter(); // Remove null entries

        return $actuals->concat($forecasts)->values()->all();
    }

    private function getCashInSourceAmount(string $jobNumber, Carbon $sourceMonth): ?float
    {
        $rules = $this->getForecastRules();
        $currentMonth = Carbon::now()->format('Y-m');
        $startMonth = Carbon::now()->subMonths(3)->startOfMonth();

        $sources = $this->getCashInSources($rules, $currentMonth, $startMonth);
        foreach ($sources as $source) {
            if ($source['job_number'] !== $jobNumber) {
                continue;
            }
            if ($source['month'] !== $sourceMonth->format('Y-m')) {
                continue;
            }
            return (float) $source['amount'];
        }

        return null;
    }

    private function getCashOutSourceAmount(string $jobNumber, string $costItem, ?string $vendor, Carbon $sourceMonth): ?float
    {
        $rules = $this->getForecastRules();
        $currentMonth = Carbon::now()->format('Y-m');
        $startMonth = Carbon::now()->subMonths(3)->startOfMonth();

        $sources = $this->getCashOutSources($rules, $currentMonth, $startMonth);
        $vendorKey = $vendor ?: 'GL';
        $isVendorLevel = $jobNumber === 'ALL';
        $total = 0.0;
        foreach ($sources as $source) {
            if ($source['cost_item'] !== $costItem) {
                continue;
            }
            if (($source['vendor'] ?? 'GL') !== $vendorKey) {
                continue;
            }
            if ($source['month'] !== $sourceMonth->format('Y-m')) {
                continue;
            }

            if ($isVendorLevel) {
                $total += (float) $source['amount'];
                continue;
            }

            if ($source['job_number'] !== $jobNumber) {
                continue;
            }

            return (float) $source['amount'];
        }

        if ($isVendorLevel) {
            return $total > 0 ? $total : null;
        }

        return null;
    }
}
