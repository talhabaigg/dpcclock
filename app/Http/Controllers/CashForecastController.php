<?php

namespace App\Http\Controllers;

use App\Models\ArPostedInvoice;
use App\Models\ArProgressBillingSummary;
use App\Models\CashForecastGeneralCost;
use App\Models\CashForecastSetting;
use App\Models\CashInAdjustment;
use App\Models\CashOutAdjustment;
use App\Models\CostCode;
use App\Models\JobCostDetail;
use App\Models\JobForecastData;
use App\Models\JobRetentionSetting;
use App\Models\VendorPaymentDelay;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class CashForecastController extends Controller
{
    private ?array $cachedRules = null;

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
        $vendorPaymentDelaysData = $this->getVendorPaymentDelaysGrouped($rangeStart, $rangeEnd);
        $rules['vendor_payment_delays'] = $vendorPaymentDelaysData;

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
        // Only use actuals BEFORE current month — current month uses forecast data exclusively
        // to avoid confusing mix of partial actuals + remaining forecast.
        // Past-month actuals still feed into the delay rules (e.g. Jan wages → 30% tax in Feb).
        $allActualData = $this->getActualData($rules);
        $actualData = $allActualData->filter(fn ($item) => $item->month < $currentMonth);

        // Get forecast data including past months for delay lookback.
        // We need past-month data so delayed portions land in the current month.
        // Example: Jan actual 01-01 → 30% tax delayed +1m to Feb (current month).
        // Example: Jan actual 99-99 → revenue delayed +1m to Feb (current month).
        // Look back 2 months to cover the full delay window (revenue = 1m, wages tax = 1m, oncosts = 1m)
        // plus buffer to ensure past-month forecasts fully feed delayed portions into current month.
        $cashInCode = $rules['cash_in_code'] ?? '99-99';
        $forecastLookbackMonth = Carbon::now()->subMonths(2)->format('Y-m');
        $latestForecasts = $this->getLatestForecastsSubquery();
        $forecastData = JobForecastData::select(
            'job_forecast_data.month',
            'job_forecast_data.cost_item',
            'job_forecast_data.forecast_amount',
            'job_forecast_data.job_number',
            DB::raw('NULL as vendor'),
            DB::raw("'forecast' as source")
        )
            ->join('job_forecasts as jf', 'job_forecast_data.job_forecast_id', '=', 'jf.id')
            ->joinSub($latestForecasts, 'latest_forecasts', function ($join) {
                $join->on('jf.job_number', '=', 'latest_forecasts.job_number')
                    ->on('jf.forecast_month', '=', 'latest_forecasts.forecast_month');
            })
            ->where('job_forecast_data.month', '>=', $forecastLookbackMonth)
            ->get();

        // For past months, deduplicate: actuals take priority over forecasts.
        // If actual data exists for a job+cost_item+month, drop the forecast to avoid double-counting.
        // This keeps past-month forecasts only for items WITHOUT actuals (e.g. wages not in AP).
        $actualKeys = $actualData->map(fn ($item) => $item->job_number.'|'.$item->cost_item.'|'.($item->vendor ?? 'GL').'|'.$item->month)
            ->unique()
            ->flip()
            ->all();

        $forecastData = $forecastData->filter(function ($item) use ($actualKeys, $currentMonth) {
            // Always keep current and future month forecasts
            if ($item->month >= $currentMonth) {
                return true;
            }
            // For past months, only keep if no actual exists for this job+cost_item+vendor+month
            $key = $item->job_number.'|'.$item->cost_item.'|'.($item->vendor ?? 'GL').'|'.$item->month;

            return ! isset($actualKeys[$key]);
        });

        // Get retention data and generate retention rows
        $retentionData = $this->getRetentionData($rules, $currentMonth);
        $retentionRows = $this->generateRetentionRows($actualData, $forecastData, $retentionData, $currentMonth, $cashInCode);

        // Combine actuals (past months only), forecasts (with gap-filled past months), and retention
        $combinedData = $actualData->concat($forecastData)->concat($retentionRows);

        // Generate month range starting from current month
        $allMonths = $this->generateMonthRange(Carbon::now(), 12);

        $transformedRows = $this->applyRules($combinedData, $rules);

        // Add general costs for the forecast display
        $generalCostRows = $this->getGeneralCostRows($allMonths);
        $transformedRows = $transformedRows->concat($generalCostRows);

        $gstPayableRows = $this->calculateQuarterlyGstPayable($transformedRows, $rules);

        // For GST breakdown, include historical general costs to capture past quarters
        $historicalGeneralCostRows = $this->getGeneralCostRows($allMonths, true);
        $rowsForGstBreakdown = $transformedRows->concat(
            // Add historical general costs that aren't already in transformedRows
            $historicalGeneralCostRows->filter(function ($row) use ($allMonths) {
                return ! in_array($row->month, $allMonths);
            })
        );
        $gstBreakdown = $this->calculateGstBreakdown($rowsForGstBreakdown, $rules, $costCodeDescriptions);

        $allMonthsWithCostSummary = $this->buildMonthHierarchy(
            $allMonths,
            $transformedRows->concat($gstPayableRows),
            $costCodeDescriptions,
            $cashInCode
        );

        // Get general costs for the settings panel
        $generalCosts = CashForecastGeneralCost::where('is_active', true)
            ->orderBy('name')
            ->get();

        $cashInSources = $this->getCashInSources($rules, $currentMonth, $rangeStart);
        $cashOutSources = $this->getCashOutSources($rules, $currentMonth, $rangeStart);
        $vendorPaymentDelays = $this->getVendorPaymentDelays($rangeStart, $rangeEnd);

        // Build breakdown rows from transformed data (general costs already in $transformedRows from line 90)
        $allTransformedRows = $transformedRows->concat($gstPayableRows);
        $breakdownRows = $this->formatBreakdownRows($allTransformedRows, $cashInCode, $costCodeDescriptions);

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
            'gstBreakdown' => $gstBreakdown,
            'breakdownRows' => $breakdownRows,
            'retentionSummary' => $this->buildRetentionSummary($retentionData),
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
        if (abs($splitTotal - $sourceAmount) > 0.01) {
            return back()->withErrors(['splits' => 'Split total must equal the billed amount (within $0.01).']);
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

            if (! empty($rows)) {
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
        if (abs($splitTotal - $sourceAmount) > 0.01) {
            return back()->withErrors(['splits' => 'Split total must equal the source amount (within $0.01).']);
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

            if (! empty($rows)) {
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
                ->filter(fn ($split) => (float) $split['amount'] > 0)
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

            if (! empty($rows)) {
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
            ->where('job_cost_details.cost_item', 'not like', 'GL-%')
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
                DB::raw($monthExpression.' as month'),
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
    private function getGeneralCostRows(array $months, bool $includeHistorical = false): \Illuminate\Support\Collection
    {
        $generalCosts = CashForecastGeneralCost::where('is_active', true)->get();
        $rows = collect();

        if ($generalCosts->isEmpty()) {
            return $rows;
        }

        $currentMonth = Carbon::now()->format('Y-m');

        // For GST calculation, include historical months going back to start of fiscal year (Jul 1)
        // This ensures we capture all quarters for the current financial year
        if ($includeHistorical) {
            $now = Carbon::now();
            // Go back to start of current financial year (Jul 1)
            $fyStart = $now->month >= 7
                ? Carbon::create($now->year, 7, 1)
                : Carbon::create($now->year - 1, 7, 1);
            $startMonth = $fyStart->copy()->startOfMonth();
        } else {
            $startMonth = Carbon::createFromFormat('Y-m', $months[0])->startOfMonth();
        }
        $endMonth = Carbon::createFromFormat('Y-m', end($months))->endOfMonth();

        foreach ($generalCosts as $cost) {
            $cashflows = $cost->getCashflowsForRange($startMonth, $endMonth);

            foreach ($cashflows as $month => $amount) {
                // Determine source based on whether month is in the past
                $source = $month < $currentMonth ? 'actual' : 'forecast';

                $rows->push((object) [
                    'month' => $month,
                    'source_month' => $month,
                    'cost_item' => 'GENERAL-'.strtoupper($cost->category ?? 'OTHER'),
                    'job_number' => $cost->name,
                    'vendor' => null,
                    'forecast_amount' => $amount,
                    'gst_rate' => ($this->getForecastRules()['gst_rate'] ?? 0.10),
                    'is_general_cost' => true,
                    'flow_type' => $cost->flow_type ?? 'cash_out',
                    'source' => $source,
                ]);
            }
        }

        return $rows;
    }

    /**
     * Get actual cost and revenue data from Job Cost Details and AR Posted Invoices.
     * JobCostDetail is the comprehensive source that includes ALL job costs —
     * wages, oncosts, AND vendor costs.
     */
    private function getActualData(array $rules): \Illuminate\Support\Collection
    {
        $cashInCode = $rules['cash_in_code'];

        // Get cost actuals from Job Cost Details (comprehensive: wages + oncosts + vendor costs)
        $costActuals = JobCostDetail::select(
            'job_number',
            'cost_item',
            'cost_type',
            'transaction_date',
            'amount',
            'vendor'
        )
            ->where('transaction_date', '>=', Carbon::now()->subMonths(3)->startOfMonth())
            ->whereNotNull('cost_item')
            ->where('cost_item', '!=', '')
            ->get()
            ->map(function ($item) {
                $exGstAmount = (float) $item->amount;

                return (object) [
                    'job_number' => $item->job_number ?: 'General',
                    'cost_item' => $item->cost_item,
                    'month' => Carbon::parse($item->transaction_date)->format('Y-m'),
                    'forecast_amount' => $exGstAmount,  // ex-GST amount from JC
                    'actual_gst' => null,  // GST calculated by applyRules based on cost item type
                    'vendor' => $item->vendor ?: 'GL',
                    'is_actual' => true,
                    'source' => 'actual',
                ];
            });

        // Get revenue actuals from AR Posted Invoices
        // Using invoice_date for timing, subtotal (ex-GST) as base, and tax2 as actual GST
        $revenueActuals = ArPostedInvoice::select('job_number', 'invoice_date', 'subtotal', 'tax2', 'retainage')
            ->where('invoice_date', '>=', Carbon::now()->subMonths(3)->startOfMonth())
            ->where('invoice_status', '!=', 'VOID')
            ->get()
            ->map(function ($item) use ($cashInCode) {
                $exGstAmount = (float) $item->subtotal;
                $actualGst = (float) $item->tax2;
                $actualRetainage = (float) ($item->retainage ?? 0);

                return (object) [
                    'job_number' => $item->job_number,
                    'cost_item' => $cashInCode,
                    'month' => Carbon::parse($item->invoice_date)->format('Y-m'),
                    'forecast_amount' => $exGstAmount,  // Store ex-GST amount
                    'actual_gst' => $actualGst,  // Store actual GST from invoice
                    'actual_retainage' => $actualRetainage,  // Retention held back
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
            ->filter(fn ($item) => $item->month === $currentMonth)
            ->groupBy(fn ($item) => $item->job_number.'|'.$item->cost_item)
            ->map(fn ($items) => $items->sum('forecast_amount'));

        return $forecastData->map(function ($item) use ($currentMonth, $currentMonthActualTotals) {
            // Only adjust current month forecasts
            if ($item->month !== $currentMonth) {
                return $item;
            }

            $key = $item->job_number.'|'.$item->cost_item;
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
        if ($this->cachedRules !== null) {
            return $this->cachedRules;
        }

        $settings = CashForecastSetting::current();
        $gstRate = (float) ($settings->gst_rate ?? 0.10);
        $wageTaxRatio = (float) ($settings->wage_tax_ratio ?? 0.30);
        $wageNetRatio = round(1 - $wageTaxRatio, 4);

        return $this->cachedRules = [
            // Cash-in cost item (used to separate inflows vs outflows).
            'cash_in_code' => '99-99',
            // Cost item code to represent GST payable in the cash flow.
            'gst_payable_code' => 'GST-PAYABLE',
            // General cost code prefix
            'general_cost_prefix' => 'GENERAL-',

            // Configurable rates from settings
            'gst_rate' => $gstRate,
            'default_retention_rate' => (float) ($settings->default_retention_rate ?? 0.05),
            'default_retention_cap_pct' => (float) ($settings->default_retention_cap_pct ?? 0.05),

            // =================================================================
            // RULE 1: Wages (01-01, 03-01, 05-01, 07-01)
            // Split tax (paid +1 month) / net wages (paid same month)
            // NO GST on wages
            // =================================================================
            'cost_item_delay_splits' => [
                '01-01' => [
                    ['delay' => 0, 'ratio' => $wageNetRatio],  // Net wages paid same month
                    ['delay' => 1, 'ratio' => $wageTaxRatio],  // Tax paid next month
                ],
                '03-01' => [
                    ['delay' => 0, 'ratio' => $wageNetRatio],
                    ['delay' => 1, 'ratio' => $wageTaxRatio],
                ],
                '05-01' => [
                    ['delay' => 0, 'ratio' => $wageNetRatio],
                    ['delay' => 1, 'ratio' => $wageTaxRatio],
                ],
                '07-01' => [
                    ['delay' => 0, 'ratio' => $wageNetRatio],
                    ['delay' => 1, 'ratio' => $wageTaxRatio],
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
            // GST + delay +1 month (30 day terms)
            // =================================================================
            'vendor_cost_prefix' => [
                'min' => 20,
                'max' => 98,
                'gst_rate' => $gstRate,
                'delay_months' => 1,
            ],

            // =================================================================
            // RULE 4: Revenue (99-99)
            // GST collected + delay +1 month
            // =================================================================
            'revenue_gst_rate' => $gstRate,
            'revenue_delay_months' => 1,
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
        if (! $input) {
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
        $revenueDelayMonths = $rules['revenue_delay_months'] ?? 1;
        $generalCostPrefix = $rules['general_cost_prefix'] ?? 'GENERAL-';
        $cashInAdjustments = $rules['cash_in_adjustments'] ?? [];
        $cashOutAdjustments = $rules['cash_out_adjustments'] ?? [];
        $vendorPaymentDelays = $rules['vendor_payment_delays'] ?? [];

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
            $key = $vendorKey.'|'.$item->cost_item.'|'.$item->month;
            $carry[$key] = ($carry[$key] ?? 0) + (float) $item->forecast_amount;

            return $carry;
        }, []);

        // Build vendor-wide totals (across ALL cost items) for vendor payment delay proportioning
        $vendorWideTotals = $forecastData->reduce(function ($carry, $item) use ($cashInCode, $generalCostPrefix) {
            if ($item->cost_item === $cashInCode) {
                return $carry;
            }
            if (str_starts_with($item->cost_item, $generalCostPrefix)) {
                return $carry;
            }
            $vendorKey = $item->vendor ?: 'GL';
            $key = $vendorKey.'|'.$item->month;
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
            $vendorPaymentDelays,
            $vendorTotals,
            $vendorWideTotals
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
                        'rule' => 'General cost (no delay)',
                    ],
                ];
            }

            // =================================================================
            // RULE 4: Revenue (99-99) - GST + 2 month delay
            // For actuals: use actual GST from invoice (tax2)
            // For forecasts: calculate GST at 10%
            // =================================================================
            if ($costItem === $cashInCode) {
                $adjustmentKey = $item->job_number.'|'.$item->month;
                $adjustments = $cashInAdjustments[$adjustmentKey] ?? null;

                // For actuals, use the actual GST from the invoice; for forecasts, calculate it
                $hasActualGst = isset($item->actual_gst) && ($item->source ?? null) === 'actual';
                $actualGst = $hasActualGst ? (float) $item->actual_gst : 0;
                $grossAmount = $hasActualGst ? ($amount + $actualGst) : ($amount * (1 + $revenueGstRate));

                if (! empty($adjustments)) {
                    $adjustedTotal = collect($adjustments)->sum('amount');
                    $rows = collect($adjustments)->map(function ($adjustment) use ($item, $revenueGstRate, $hasActualGst, $actualGst, $amount) {
                        $adjAmount = (float) $adjustment['amount'];
                        // Proportion the actual GST for this adjustment
                        $adjGst = $hasActualGst && $amount > 0 ? ($actualGst * $adjAmount / $amount) : ($adjAmount * $revenueGstRate);

                        return (object) [
                            'month' => $adjustment['receipt_month'],
                            'source_month' => $item->month,
                            'cost_item' => $item->cost_item,
                            'job_number' => $item->job_number,
                            'vendor' => $item->vendor ?? null,
                            'forecast_amount' => $adjAmount + $adjGst,
                            'gst_rate' => $revenueGstRate,
                            'actual_gst_amount' => $hasActualGst ? $adjGst : null,
                            'source' => $item->source ?? null,
                            'rule' => 'Cash-in adjustment (manual)',
                        ];
                    });

                    $remaining = $amount - $adjustedTotal;
                    if ($remaining > 0.01) {
                        $delayedMonth = Carbon::createFromFormat('Y-m', $item->month)
                            ->addMonths($revenueDelayMonths)
                            ->format('Y-m');

                        $remainingGst = $hasActualGst && $amount > 0 ? ($actualGst * $remaining / $amount) : ($remaining * $revenueGstRate);
                        $rows->push((object) [
                            'month' => $delayedMonth,
                            'source_month' => $item->month,
                            'cost_item' => $costItem,
                            'job_number' => $item->job_number,
                            'vendor' => $item->vendor ?? null,
                            'forecast_amount' => $remaining + $remainingGst,
                            'gst_rate' => $revenueGstRate,
                            'actual_gst_amount' => $hasActualGst ? $remainingGst : null,
                            'source' => $item->source ?? null,
                            'rule' => "Revenue +".$revenueDelayMonths."m delay (remainder after adj)",
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
                        'forecast_amount' => $grossAmount,
                        'gst_rate' => $revenueGstRate,
                        'actual_gst_amount' => $hasActualGst ? $actualGst : null,
                        'source' => $item->source ?? null,
                        'rule' => "Revenue +".$revenueDelayMonths."m delay (+".($revenueGstRate * 100)."% GST)",
                    ],
                ];
            }

            // =================================================================
            // RULE 5: Retention (RET-HELD)
            // Same delay as revenue, NO GST on retention deductions
            // =================================================================
            if ($costItem === 'RET-HELD') {
                $delayedMonth = Carbon::createFromFormat('Y-m', $item->month)
                    ->addMonths($revenueDelayMonths)
                    ->format('Y-m');

                return [
                    (object) [
                        'month' => $delayedMonth,
                        'source_month' => $item->month,
                        'cost_item' => 'RET-HELD',
                        'job_number' => $item->job_number,
                        'vendor' => null,
                        'forecast_amount' => (float) $item->forecast_amount,
                        'gst_rate' => 0, // No GST on retention
                        'source' => $item->source ?? null,
                        'rule' => 'Retention +'.$revenueDelayMonths.'m delay (no GST)',
                    ],
                ];
            }

            $vendorKey = $vendor ?: 'GL';
            $adjustmentKey = $item->job_number.'|'.$costItem.'|'.$vendorKey.'|'.$item->month;
            $vendorAdjustmentKey = 'ALL'.'|'.$costItem.'|'.$vendorKey.'|'.$item->month;
            $adjustments = $cashOutAdjustments[$adjustmentKey] ?? null;
            $adjustmentRows = collect();
            $hasAdjustments = false;
            $isVendorLevel = false;
            if (empty($adjustments)) {
                $adjustments = $cashOutAdjustments[$vendorAdjustmentKey] ?? null;
                $isVendorLevel = ! empty($adjustments);
            }

            if (! empty($adjustments)) {
                if ($isVendorLevel && ($item->source ?? null) !== 'actual') {
                    $adjustments = null;
                }
            }

            if (! empty($adjustments)) {
                $gstRate = 0;
                if ($this->isPrefixInRange($prefix, $vendorCostPrefix['min'] ?? null, $vendorCostPrefix['max'] ?? null)) {
                    $gstRate = $vendorCostPrefix['gst_rate'] ?? 0.10;
                }

                $vendorTotalKey = $vendorKey.'|'.$costItem.'|'.$item->month;
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
                        'rule' => 'Cash-out adjustment (manual)',
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
            // TIER 3: Vendor Payment Delays (broadest override)
            // Applies across all cost items for a vendor+month when no
            // cash-out adjustment already handled the item.
            // Only applies to vendor costs (prefixes 20-98) and GL costs.
            // =================================================================
            if (! $hasAdjustments && $vendor) {
                $vendorDelayKey = $vendor.'|'.$item->month;
                $vendorDelays = $vendorPaymentDelays[$vendorDelayKey] ?? null;

                if (! empty($vendorDelays)) {
                    $isDelayableVendorCost = $this->isPrefixInRange($prefix, $vendorCostPrefix['min'] ?? null, $vendorCostPrefix['max'] ?? null);
                    $isGlCost = str_starts_with($costItem, 'GL-');

                    if ($isDelayableVendorCost || $isGlCost) {
                        $gstRate = 0;
                        if ($isDelayableVendorCost || $isGlCost) {
                            $gstRate = $vendorCostPrefix['gst_rate'] ?? 0.10;
                        }

                        // Proportion this item's amount relative to the vendor's total for this month
                        $vendorWideTotalKey = $vendor.'|'.$item->month;
                        $vendorWideTotal = (float) ($vendorWideTotals[$vendorWideTotalKey] ?? 0);
                        $portion = $vendorWideTotal > 0 ? min(1, $amount / $vendorWideTotal) : 1;

                        // For actuals, use the actual GST from the invoice
                        $hasActualGst = isset($item->actual_gst) && ($item->source ?? null) === 'actual';
                        $actualGst = $hasActualGst ? (float) $item->actual_gst : 0;

                        $delayTotal = collect($vendorDelays)->sum('amount') * $portion;
                        $delayRows = collect($vendorDelays)->map(function ($delay) use ($item, $gstRate, $portion, $hasActualGst, $actualGst, $amount) {
                            $delayAmount = (float) $delay['amount'] * $portion;
                            $delayGst = $hasActualGst && $amount > 0
                                ? ($actualGst * $delayAmount / $amount)
                                : ($delayAmount * $gstRate);

                            return (object) [
                                'month' => $delay['payment_month'],
                                'source_month' => $item->month,
                                'cost_item' => $item->cost_item,
                                'job_number' => $item->job_number,
                                'vendor' => $item->vendor ?? null,
                                'forecast_amount' => $delayAmount + $delayGst,
                                'gst_rate' => $gstRate,
                                'actual_gst_amount' => $hasActualGst ? $delayGst : null,
                                'source' => $item->source ?? null,
                                'rule' => 'Vendor payment delay (manual)',
                            ];
                        });

                        $remaining = $amount - $delayTotal;
                        if ($remaining <= 0.01) {
                            return $adjustmentRows->isNotEmpty() ? $adjustmentRows->concat($delayRows) : $delayRows;
                        }

                        $amount = $remaining;
                        $hasAdjustments = true;
                        $adjustmentRows = $adjustmentRows->concat($delayRows);
                    }
                }
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

                    $pct = (int) ($split['ratio'] * 100);
                    $ruleLabel = $split['delay'] === 0
                        ? "Wages {$pct}% same month (no GST)"
                        : "Tax {$pct}% +{$split['delay']}m delay (no GST)";

                    return (object) [
                        'month' => $delayedMonth,
                        'source_month' => $item->month,
                        'cost_item' => $item->cost_item,
                        'job_number' => $item->job_number,
                        'vendor' => $item->vendor ?? null,
                        'forecast_amount' => $amount * (float) $split['ratio'],
                        'gst_rate' => 0, // No GST on wages
                        'source' => $item->source ?? null,
                        'rule' => $ruleLabel,
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
                        'rule' => "Oncost +{$oncostDelayMonths}m delay (no GST)",
                    ],
                ]);

                return $hasAdjustments ? $adjustmentRows->concat($rows) : $rows;
            }

            // =================================================================
            // RULE 3: Vendor costs (prefixes 20-98) or GL costs - GST + 1 month delay
            // For actuals: use actual GST from invoice (tax2)
            // For forecasts: calculate GST at 10%
            // =================================================================
            $isVendorCost = $this->isPrefixInRange($prefix, $vendorCostPrefix['min'] ?? null, $vendorCostPrefix['max'] ?? null);
            $isGlCost = str_starts_with($costItem, 'GL-');

            if ($isVendorCost || $isGlCost) {
                $delayMonths = $vendorCostPrefix['delay_months'] ?? 1;
                $delayedMonth = Carbon::createFromFormat('Y-m', $item->month)
                    ->addMonths($delayMonths)
                    ->format('Y-m');

                // For actuals, use the actual GST from the invoice; for forecasts, calculate it
                $hasActualGst = isset($item->actual_gst) && ($item->source ?? null) === 'actual';
                $actualGst = $hasActualGst ? (float) $item->actual_gst : 0;
                $gstRate = $vendorCostPrefix['gst_rate'] ?? 0.10;
                $grossAmount = $hasActualGst ? ($amount + $actualGst) : ($amount * (1 + $gstRate));

                $typeLabel = $isGlCost ? 'GL cost' : 'Vendor cost';
                $gstPct = (int) ($gstRate * 100);

                $rows = collect([
                    (object) [
                        'month' => $delayedMonth,
                        'source_month' => $item->month,
                        'cost_item' => $costItem,
                        'job_number' => $item->job_number,
                        'vendor' => $item->vendor ?? null,
                        'forecast_amount' => $grossAmount,
                        'gst_rate' => $gstRate,
                        'actual_gst_amount' => $hasActualGst ? $actualGst : null,
                        'source' => $item->source ?? null,
                        'rule' => "{$typeLabel} +{$delayMonths}m delay (+{$gstPct}% GST)",
                    ],
                ]);

                return $hasAdjustments ? $adjustmentRows->concat($rows) : $rows;
            }

            // =================================================================
            // Default: No delay, use actual GST if available (other cost items)
            // =================================================================
            $hasActualGst = isset($item->actual_gst) && ($item->source ?? null) === 'actual';
            $actualGst = $hasActualGst ? (float) $item->actual_gst : 0;
            $grossAmount = $hasActualGst ? ($amount + $actualGst) : $amount;

            $rows = collect([
                (object) [
                    'month' => $item->month,
                    'source_month' => $item->month,
                    'cost_item' => $costItem,
                    'job_number' => $item->job_number,
                    'vendor' => $item->vendor ?? null,
                    'forecast_amount' => $grossAmount,
                    'gst_rate' => 0,
                    'actual_gst_amount' => $hasActualGst ? $actualGst : null,
                    'source' => $item->source ?? null,
                    'rule' => 'No delay (same month)',
                ],
            ]);

            return $hasAdjustments ? $adjustmentRows->concat($rows) : $rows;
        });
    }

    private function buildMonthHierarchy(array $months, $forecastRows, array $costCodeDescriptions = [], string $cashInCode = '99-99')
    {
        // Organize rows so the UI can render month -> cash in/out -> cost item -> job.
        $forecastByMonth = $forecastRows->groupBy('month');

        return collect($months)->map(function ($month) use ($forecastByMonth, $cashInCode, $costCodeDescriptions) {
            $monthItems = $forecastByMonth->get($month, collect());
            $cashInItems = $monthItems->filter(function ($item) use ($cashInCode) {
                return ($item->flow_type ?? null) === 'cash_in'
                    || $item->cost_item === $cashInCode
                    || $item->cost_item === 'RET-HELD';
            });
            $cashOutItems = $monthItems->filter(function ($item) use ($cashInCode) {
                return ! ((($item->flow_type ?? null) === 'cash_in')
                    || $item->cost_item === $cashInCode
                    || $item->cost_item === 'RET-HELD');
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

    /**
     * Format transformed rows into a breakdown-friendly structure for the frontend.
     * Each row represents a single contribution to a month's cash in or cash out.
     */
    private function formatBreakdownRows($transformedRows, string $cashInCode, array $costCodeDescriptions): array
    {
        return $transformedRows->map(function ($row) use ($cashInCode, $costCodeDescriptions) {
            $isCashIn = (($row->flow_type ?? null) === 'cash_in') || ($row->cost_item === $cashInCode);
            $gstRate = (float) ($row->gst_rate ?? 0);
            $grossAmount = (float) $row->forecast_amount;

            // Calculate ex-GST and GST amounts
            if (isset($row->actual_gst_amount) && $row->actual_gst_amount !== null) {
                $gstAmount = (float) $row->actual_gst_amount;
                $exGstAmount = $grossAmount - $gstAmount;
            } elseif ($gstRate > 0) {
                $gstAmount = $grossAmount - ($grossAmount / (1 + $gstRate));
                $exGstAmount = $grossAmount - $gstAmount;
            } else {
                $gstAmount = 0;
                $exGstAmount = $grossAmount;
            }

            return [
                'month' => $row->month,
                'source_month' => $row->source_month ?? $row->month,
                'cost_item' => $row->cost_item,
                'cost_item_description' => $costCodeDescriptions[$row->cost_item] ?? null,
                'job_number' => $row->job_number,
                'vendor' => $row->vendor ?? null,
                'amount' => round($grossAmount, 2),
                'ex_gst_amount' => round($exGstAmount, 2),
                'gst_amount' => round($gstAmount, 2),
                'gst_rate' => $gstRate,
                'source' => $row->source ?? 'forecast',
                'flow_type' => $isCashIn ? 'cash_in' : 'cash_out',
                'rule' => $row->rule ?? 'Unknown',
            ];
        })->values()->all();
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

        // Group GST by month using actual GST amounts where available, otherwise calculate from rate
        // This uses cash-method dates (delays already applied)
        $monthlyGst = $forecastRows->reduce(function ($carry, $row) use ($cashInCode) {
            // Use actual GST amount if available (from AR Posted Invoices), otherwise calculate from rate
            $gstAmount = 0.0;
            if (isset($row->actual_gst_amount) && $row->actual_gst_amount !== null) {
                $gstAmount = (float) $row->actual_gst_amount;
            } else {
                $gstRate = $row->gst_rate ?? 0;
                if ($gstRate > 0) {
                    $gstAmount = $this->extractGstFromGross((float) $row->forecast_amount, (float) $gstRate);
                }
            }

            if ($gstAmount == 0) {
                return $carry;
            }

            $monthKey = $row->source_month ?? $row->month;

            if (! isset($carry[$monthKey])) {
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
            $key = $date->year.'-Q'.$date->quarter;

            if (! isset($quarterBuckets[$key])) {
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
            $payableMonth = $this->calculateGstPayMonth($quarter, $bucket['year'], $payMonths);

            $rows->push((object) [
                'month' => $payableMonth,
                'source_month' => $payableMonth,
                'cost_item' => $gstPayableCode,
                'job_number' => 'GST',
                'forecast_amount' => (float) $netGst,
                'gst_rate' => 0, // GST payable itself has no GST
                'rule' => "Q{$quarter} {$bucket['year']} net GST payable",
                'source' => 'forecast',
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

    /**
     * Calculate detailed GST breakdown for each quarter.
     * Returns transaction-level details for GST collected and paid.
     */
    private function calculateGstBreakdown($forecastRows, array $rules, array $costCodeDescriptions): array
    {
        $cashInCode = $rules['cash_in_code'] ?? '99-99';
        $payMonths = $rules['gst_pay_months'] ?? [];

        // Collect detailed GST transactions grouped by quarter
        $quarterDetails = [];

        foreach ($forecastRows as $row) {
            // Use actual GST amount if available (from AR Posted Invoices), otherwise calculate from rate
            $gstAmount = 0.0;
            if (isset($row->actual_gst_amount) && $row->actual_gst_amount !== null) {
                $gstAmount = (float) $row->actual_gst_amount;
            } else {
                $gstRate = $row->gst_rate ?? 0;
                if ($gstRate > 0) {
                    $gstAmount = $this->extractGstFromGross((float) $row->forecast_amount, (float) $gstRate);
                }
            }

            if ($gstAmount == 0) {
                continue;
            }

            $monthKey = $row->source_month ?? $row->month;
            $date = Carbon::createFromFormat('Y-m', $monthKey);
            $quarterKey = $date->year.'-Q'.$date->quarter;

            if (! isset($quarterDetails[$quarterKey])) {
                $quarter = $date->quarter;

                $quarterDetails[$quarterKey] = [
                    'quarter' => $quarterKey,
                    'quarter_label' => 'Q'.$quarter.' '.$date->year,
                    'pay_month' => $this->calculateGstPayMonth($quarter, $date->year, $payMonths),
                    'collected' => [
                        'total' => 0.0,
                        'transactions' => [],
                    ],
                    'paid' => [
                        'total' => 0.0,
                        'transactions' => [],
                    ],
                    'net' => 0.0,
                ];
            }

            $transaction = [
                'month' => $monthKey,
                'job_number' => $row->job_number ?? null,
                'vendor' => $row->vendor ?? null,
                'cost_item' => $row->cost_item ?? null,
                'cost_item_description' => $costCodeDescriptions[$row->cost_item] ?? null,
                'gross_amount' => (float) $row->forecast_amount,
                'gst_amount' => round($gstAmount, 2),
                'source' => $row->source ?? 'forecast',
            ];

            if (($row->flow_type ?? null) === 'cash_in' || $row->cost_item === $cashInCode) {
                $quarterDetails[$quarterKey]['collected']['total'] += $gstAmount;
                $quarterDetails[$quarterKey]['collected']['transactions'][] = $transaction;
            } else {
                $quarterDetails[$quarterKey]['paid']['total'] += $gstAmount;
                $quarterDetails[$quarterKey]['paid']['transactions'][] = $transaction;
            }
        }

        // Calculate net and round totals
        foreach ($quarterDetails as &$quarter) {
            $quarter['collected']['total'] = round($quarter['collected']['total'], 2);
            $quarter['paid']['total'] = round($quarter['paid']['total'], 2);
            $quarter['net'] = round($quarter['collected']['total'] - $quarter['paid']['total'], 2);

            // Sort transactions by month, then job number
            usort($quarter['collected']['transactions'], fn ($a, $b) => strcmp($a['month'].($a['job_number'] ?? ''), $b['month'].($b['job_number'] ?? ''))
            );
            usort($quarter['paid']['transactions'], fn ($a, $b) => strcmp($a['month'].($a['vendor'] ?? '').($a['cost_item'] ?? ''), $b['month'].($b['vendor'] ?? '').($b['cost_item'] ?? ''))
            );
        }

        // Sort by quarter key
        ksort($quarterDetails);

        return array_values($quarterDetails);
    }

    /**
     * Calculate the GST payment month for a given quarter.
     * Handles year rollover correctly (e.g. Q4 2025 → Jan 2026).
     */
    private function calculateGstPayMonth(int $quarter, int $year, array $payMonths): string
    {
        $quarterEndMonth = $quarter * 3; // Q1=3, Q2=6, Q3=9, Q4=12
        $payMonth = (int) ($payMonths[$quarter] ?? ($quarterEndMonth + 1));
        $payYear = $year;

        if ($payMonth > 12) {
            $payMonth -= 12;
            $payYear += 1;
        } elseif ($payMonth <= $quarterEndMonth) {
            // Pay month is before or at quarter end — must be next year
            // e.g. Q4 (Oct-Dec) paying in Feb → Feb is next year
            $payYear += 1;
        }
        // else: pay month is after quarter end in the same year (normal case)

        return Carbon::create($payYear, $payMonth, 1)->format('Y-m');
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
            ->groupBy(fn ($adjustment) => $adjustment['job_number'].'|'.$adjustment['source_month'])
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
            ->groupBy(fn ($adjustment) => $adjustment['job_number'].'|'.$adjustment['cost_item'].'|'.($adjustment['vendor'] ?? 'GL').'|'.$adjustment['source_month'])
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

    /**
     * Get vendor payment delays grouped by vendor|source_month for use in applyRules().
     */
    private function getVendorPaymentDelaysGrouped(Carbon $startMonth, Carbon $endMonth): array
    {
        return VendorPaymentDelay::query()
            ->whereBetween('source_month', [$startMonth, $endMonth])
            ->orderBy('payment_month')
            ->get()
            ->map(function (VendorPaymentDelay $delay) {
                return [
                    'vendor' => $delay->vendor,
                    'source_month' => Carbon::parse($delay->source_month)->format('Y-m'),
                    'payment_month' => Carbon::parse($delay->payment_month)->format('Y-m'),
                    'amount' => (float) $delay->amount,
                ];
            })
            ->groupBy(fn ($delay) => $delay['vendor'].'|'.$delay['source_month'])
            ->map(fn ($items) => $items->values()->all())
            ->all();
    }

    private function getCashInSources(array $rules, string $currentMonth, Carbon $startMonth): array
    {
        $cashInCode = $rules['cash_in_code'] ?? '99-99';

        // Use AR Posted Invoices with invoice_date and subtotal (ex-GST amount)
        // Only include actuals BEFORE current month (current month uses forecast only)
        $actuals = ArPostedInvoice::select('job_number', 'invoice_date', 'subtotal', 'retainage')
            ->where('invoice_date', '>=', $startMonth)
            ->where('invoice_date', '<', Carbon::createFromFormat('Y-m', $currentMonth)->startOfMonth())
            ->where('invoice_status', '!=', 'VOID')
            ->get()
            ->groupBy(function ($item) {
                $month = Carbon::parse($item->invoice_date)->format('Y-m');

                return $item->job_number.'|'.$month;
            })
            ->map(function ($items, $key) {
                [$jobNumber, $month] = explode('|', $key, 2);

                return [
                    'job_number' => $jobNumber,
                    'month' => $month,
                    'amount' => (float) $items->sum('subtotal'),  // ex-GST amount
                    'retainage' => (float) $items->sum('retainage'),  // retention held back
                    'source' => 'actual',
                ];
            })
            ->values();

        // Forecast data for current month onwards — use full forecast amounts (no subtraction)
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
            ->map(function ($row) {
                return [
                    'job_number' => $row->job_number,
                    'month' => $row->month,
                    'amount' => (float) $row->amount,
                    'source' => 'forecast',
                ];
            });

        return $actuals->concat($forecasts)->values()->all();
    }

    private function getCashOutSources(array $rules, string $currentMonth, Carbon $startMonth): array
    {
        $cashInCode = $rules['cash_in_code'] ?? '99-99';

        // Use JobCostDetail for job cost actuals (wages + oncosts + vendor costs)
        // Only include actuals BEFORE current month (current month uses forecast only)
        $currentMonthStart = Carbon::createFromFormat('Y-m', $currentMonth)->startOfMonth();

        $jobCostActuals = JobCostDetail::select('job_number', 'cost_item', 'transaction_date', 'amount', 'vendor')
            ->where('transaction_date', '>=', $startMonth)
            ->where('transaction_date', '<', $currentMonthStart)
            ->whereNotNull('cost_item')
            ->where('cost_item', '!=', '')
            ->get()
            ->map(function ($item) {
                return [
                    'job_number' => $item->job_number ?: 'General',
                    'cost_item' => $item->cost_item,
                    'vendor' => $item->vendor ?: 'GL',
                    'month' => Carbon::parse($item->transaction_date)->format('Y-m'),
                    'amount' => (float) $item->amount,
                    'source' => 'actual',
                ];
            });

        $actuals = $jobCostActuals;

        // Forecast data for current month onwards — use full forecast amounts (no subtraction)
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
            ->map(function ($row) {
                return [
                    'job_number' => $row->job_number,
                    'cost_item' => $row->cost_item,
                    'vendor' => null,  // Forecast data has no vendor
                    'month' => $row->month,
                    'amount' => (float) $row->amount,
                    'source' => 'forecast',
                ];
            });

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

    /**
     * Get retention data for all jobs from Premier ERP + user overrides.
     */
    private function getRetentionData(array $rules, string $currentMonth): array
    {
        // Get latest progress billing summary per job for retention inference
        $latestBillings = ArProgressBillingSummary::query()
            ->select(
                'job_number',
                DB::raw('MAX(application_number) as max_app')
            )
            ->groupBy('job_number')
            ->get()
            ->pluck('max_app', 'job_number');

        $billingData = collect();
        if ($latestBillings->isNotEmpty()) {
            // Build OR conditions for each job+app pair to avoid CONCAT and N+1 queries
            $billingData = ArProgressBillingSummary::query()
                ->where(function ($query) use ($latestBillings) {
                    foreach ($latestBillings as $jobNumber => $appNumber) {
                        $query->orWhere(function ($q) use ($jobNumber, $appNumber) {
                            $q->where('job_number', $jobNumber)
                                ->where('application_number', $appNumber);
                        });
                    }
                })
                ->get()
                ->keyBy('job_number');
        }

        // Get user overrides
        $overrides = JobRetentionSetting::all()->keyBy('job_number');

        // Get actual retainage from AR Posted Invoices grouped by job+month
        $actualRetainage = ArPostedInvoice::select('job_number', 'invoice_date', 'retainage')
            ->where('invoice_date', '>=', Carbon::now()->subMonths(3)->startOfMonth())
            ->where('invoice_status', '!=', 'VOID')
            ->whereNotNull('retainage')
            ->where('retainage', '!=', 0)
            ->get()
            ->groupBy(function ($item) {
                return $item->job_number.'|'.Carbon::parse($item->invoice_date)->format('Y-m');
            })
            ->map(fn ($items) => (float) $items->sum('retainage'));

        // Build per-job retention info
        $byJob = [];
        $allJobNumbers = collect($billingData->keys())
            ->merge($overrides->keys())
            ->unique();

        foreach ($allJobNumbers as $jobNumber) {
            $billing = $billingData[$jobNumber] ?? null;
            $override = $overrides[$jobNumber] ?? null;

            $contractSum = (float) ($billing->contract_sum_to_date ?? 0);
            $retainageToDate = (float) ($billing->retainage_to_date ?? 0);

            // Infer retention rate from average of last 5 billings for stability
            $inferredRate = $rules['default_retention_rate'] ?? 0.05;
            if ($billing) {
                $recentBillings = ArProgressBillingSummary::where('job_number', $jobNumber)
                    ->orderBy('application_number', 'desc')
                    ->limit(5)
                    ->get();
                $totalWork = $recentBillings->sum(fn ($b) => (float) ($b->this_app_work_completed ?? 0));
                $totalRetainage = $recentBillings->sum(fn ($b) => (float) ($b->this_app_retainage ?? 0));
                if ($totalWork > 0 && $totalRetainage > 0) {
                    $inferredRate = $totalRetainage / $totalWork;
                }
            }

            $retentionRate = $override && ! $override->is_auto
                ? (float) $override->retention_rate
                : $inferredRate;

            $retentionCapPct = $override && ! $override->is_auto
                ? (float) $override->retention_cap_pct
                : ($rules['default_retention_cap_pct'] ?? 0.05);

            $capAmount = $contractSum * $retentionCapPct;
            $capReached = $contractSum > 0 && $retainageToDate >= $capAmount;

            $byJob[$jobNumber] = [
                'retention_rate' => $retentionRate,
                'retention_cap_pct' => $retentionCapPct,
                'contract_sum' => $contractSum,
                'retainage_to_date' => $retainageToDate,
                'cap_reached' => $capReached,
                'cap_amount' => $capAmount,
                'is_auto' => $override ? $override->is_auto : true,
                'release_date' => $override?->release_date?->format('Y-m-d'),
            ];
        }

        return [
            'by_job' => $byJob,
            'actual_retainage_by_month' => $actualRetainage->all(),
            'default_retention_rate' => $rules['default_retention_rate'] ?? 0.05,
        ];
    }

    /**
     * Generate RET-HELD rows for retention deductions and releases.
     */
    private function generateRetentionRows(
        \Illuminate\Support\Collection $actualData,
        \Illuminate\Support\Collection $forecastData,
        array $retentionData,
        string $currentMonth,
        string $cashInCode
    ): \Illuminate\Support\Collection {
        $rows = collect();
        $byJob = $retentionData['by_job'];
        $actualRetainageByMonth = $retentionData['actual_retainage_by_month'];

        // Track cumulative retention per job for cap calculations on forecasts
        $cumulativeRetention = [];
        foreach ($byJob as $jobNumber => $jobData) {
            $cumulativeRetention[$jobNumber] = $jobData['retainage_to_date'];
        }

        // 1. Generate retention rows for ACTUALS (use exact retainage from invoices)
        // Also update cumulative tracking so forecast cap calculations account for recent actuals
        $actualRevenueRows = $actualData->filter(fn ($item) => $item->cost_item === $cashInCode);
        foreach ($actualRevenueRows as $item) {
            $retainage = (float) ($item->actual_retainage ?? 0);
            if ($retainage == 0) {
                continue;
            }

            // Update cumulative tracking with actual retainage
            $jobNumber = $item->job_number;
            if (isset($cumulativeRetention[$jobNumber])) {
                $cumulativeRetention[$jobNumber] += $retainage;
            }

            $rows->push((object) [
                'month' => $item->month,
                'cost_item' => 'RET-HELD',
                'job_number' => $jobNumber,
                'forecast_amount' => -$retainage, // Negative = withheld from cash-in
                'vendor' => null,
                'source' => 'actual',
            ]);
        }

        // 2. Generate retention rows for FORECASTS (apply rate with cap logic)
        $forecastRevenueRows = $forecastData
            ->filter(fn ($item) => $item->cost_item === $cashInCode)
            ->sortBy('month');

        foreach ($forecastRevenueRows as $item) {
            $jobNumber = $item->job_number;
            $jobData = $byJob[$jobNumber] ?? null;

            if (! $jobData) {
                // No retention data for this job — apply default rate from settings
                $defaultRate = $retentionData['default_retention_rate'] ?? 0.05;
                $retention = (float) $item->forecast_amount * $defaultRate;
                if ($retention > 0) {
                    $rows->push((object) [
                        'month' => $item->month,
                        'cost_item' => 'RET-HELD',
                        'job_number' => $jobNumber,
                        'forecast_amount' => -$retention,
                        'vendor' => null,
                        'source' => 'forecast',
                    ]);
                }

                continue;
            }

            // Check cumulative cap
            $capAmount = $jobData['cap_amount'];
            $currentCumulative = $cumulativeRetention[$jobNumber] ?? 0;

            if ($capAmount > 0 && $currentCumulative >= $capAmount) {
                // Cap already reached — no more retention
                continue;
            }

            $retention = (float) $item->forecast_amount * $jobData['retention_rate'];

            // Ensure we don't exceed the cap
            if ($capAmount > 0) {
                $remaining = $capAmount - $currentCumulative;
                $retention = min($retention, $remaining);
            }

            if ($retention <= 0) {
                continue;
            }

            // Update cumulative tracking
            $cumulativeRetention[$jobNumber] = $currentCumulative + $retention;

            $rows->push((object) [
                'month' => $item->month,
                'cost_item' => 'RET-HELD',
                'job_number' => $jobNumber,
                'forecast_amount' => -$retention,
                'vendor' => null,
                'source' => 'forecast',
            ]);
        }

        // 3. Generate retention RELEASE rows for jobs with a release_date
        // Only create release if we have tracked hold rows (actual or forecast) in the forecast period
        $holdJobNumbers = $rows->pluck('job_number')->unique();
        foreach ($byJob as $jobNumber => $jobData) {
            if (empty($jobData['release_date'])) {
                continue;
            }

            // Only release if this job has corresponding hold rows in the forecast period
            if (! $holdJobNumbers->contains($jobNumber)) {
                continue;
            }

            $releaseMonth = Carbon::parse($jobData['release_date'])->format('Y-m');

            // Total held = cumulative from our tracking (retainage_to_date + actuals + forecasts)
            $totalHeld = $cumulativeRetention[$jobNumber] ?? 0;

            if ($totalHeld <= 0) {
                continue;
            }

            $rows->push((object) [
                'month' => $releaseMonth,
                'cost_item' => 'RET-HELD',
                'job_number' => $jobNumber,
                'forecast_amount' => $totalHeld, // Positive = retention released
                'vendor' => null,
                'source' => 'forecast',
            ]);
        }

        return $rows;
    }

    /**
     * Build retention summary for frontend display.
     */
    private function buildRetentionSummary(array $retentionData): array
    {
        $summary = [];
        foreach ($retentionData['by_job'] as $jobNumber => $jobData) {
            $summary[] = [
                'job_number' => $jobNumber,
                'retention_rate' => round($jobData['retention_rate'] * 100, 2),
                'retention_cap_pct' => round($jobData['retention_cap_pct'] * 100, 2),
                'contract_sum' => $jobData['contract_sum'],
                'retainage_to_date' => $jobData['retainage_to_date'],
                'cap_amount' => $jobData['cap_amount'],
                'cap_reached' => $jobData['cap_reached'],
                'is_auto' => $jobData['is_auto'],
                'release_date' => $jobData['release_date'],
            ];
        }

        usort($summary, fn ($a, $b) => strcmp($a['job_number'], $b['job_number']));

        return $summary;
    }

    /**
     * Store or update retention settings for a job.
     */
    public function storeRetentionSettings(Request $request)
    {
        $validated = $request->validate([
            'job_number' => 'required|string',
            'retention_rate' => 'required|numeric|min:0|max:100',
            'retention_cap_pct' => 'required|numeric|min:0|max:100',
            'release_date' => 'nullable|date',
            'notes' => 'nullable|string|max:500',
        ]);

        JobRetentionSetting::updateOrCreate(
            ['job_number' => $validated['job_number']],
            [
                'retention_rate' => $validated['retention_rate'] / 100, // Convert from % to decimal
                'retention_cap_pct' => $validated['retention_cap_pct'] / 100,
                'is_auto' => false, // User override
                'release_date' => $validated['release_date'],
                'notes' => $validated['notes'] ?? null,
            ]
        );

        return back()->with('success', 'Retention settings saved.');
    }

    /**
     * Delete retention override, reverting to auto-inferred settings.
     */
    public function destroyRetentionSettings(string $jobNumber)
    {
        JobRetentionSetting::where('job_number', $jobNumber)->delete();

        return back()->with('success', 'Retention settings reset to auto.');
    }
}
