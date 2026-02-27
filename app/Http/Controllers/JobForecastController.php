<?php

namespace App\Http\Controllers;

use App\Models\ArProgressBillingSummary;
use App\Models\JobCostDetail;
use App\Models\JobForecast;
use App\Models\JobForecastData;
use App\Models\JobReportByCostItemAndCostType;
use App\Models\JobSummary;
use App\Models\LabourForecast;
use App\Models\Location;
use App\Models\User;
use App\Notifications\JobForecastStatusNotification;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class JobForecastController extends Controller
{
    public function show(Request $request, $id)
    {
        $location = Location::where('id', $id)->first();
        $JobSummary = JobSummary::where('job_number', $location->external_id)->first();

        // Check if user has access to this location
        $user = Auth::user();
        if (! $user->hasRole('admin') && ! $user->hasRole('backoffice')) {
            // Get accessible location IDs based on kiosk access
            $accessibleLocationIds = $user->managedKiosks()->pluck('eh_location_id')->unique()->toArray();

            // Check if this location is accessible
            if (! in_array($location->eh_location_id, $accessibleLocationIds)) {
                abort(403, 'You do not have access to this job forecast.');
            }
        }

        $jobNumber = $location->external_id;
        $jobName = $location->name ?? 'Job '.$jobNumber;

        $lastUpdate = JobCostDetail::where('job_number', $jobNumber)->max('updated_at');

        // $jobCost = JobCostDetail::where('job_number', $jobNumber)->limit(10)->get();
        $actualsByMonth = JobCostDetail::where('job_number', $jobNumber)
            ->selectRaw("
        DATE_FORMAT(transaction_date, '%Y-%m') as month,
        cost_item, cost_item_description,
        SUM(amount) as actual,
        'actual' as type
    ")
            ->groupBy('cost_item', 'cost_item_description', 'month')
            ->orderBy('month')
            ->orderBy('cost_item')
            ->get();

        $revenuesByMonth = ArProgressBillingSummary::where('job_number', $jobNumber)
            ->selectRaw("
            DATE_FORMAT(period_end_date, '%Y-%m') as month,
            '99-99' as cost_item, 'Revenue' as cost_item_description,
            SUM(this_app_work_completed) as actual,
            MAX(contract_sum_to_date) as contract_sum_to_date,
            'actual' as type
            ")
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        // dd($revenuesByMonth);

        $months = $actualsByMonth
            ->pluck('month')
            ->unique()
            ->sort()
            ->values()
            ->all();

        // Get current month in YYYY-MM format
        $currentMonth = date('Y-m');

        $availableForecastMonths = JobForecast::where('job_number', $jobNumber)
            ->orderBy('forecast_month', 'desc')
            ->pluck('forecast_month')
            ->map(function ($date) {
                return date('Y-m', strtotime($date));
            })
            ->values()
            ->all();

        $requestedForecastMonth = $request->query('forecast_month');
        $hasRequestedForecastMonth = ! empty($requestedForecastMonth);
        $selectedForecastMonth = null;
        $forecastMonthDate = null;
        if ($requestedForecastMonth) {
            $forecastMonthDate = \DateTime::createFromFormat('Y-m', $requestedForecastMonth);
            if ($forecastMonthDate && $forecastMonthDate->format('Y-m') === $requestedForecastMonth) {
                $selectedForecastMonth = $requestedForecastMonth;
            }
        }

        if (! $selectedForecastMonth) {
            $selectedForecastMonth = $availableForecastMonths[0] ?? $currentMonth;
            $forecastMonthDate = \DateTime::createFromFormat('Y-m', $selectedForecastMonth);
        }

        $jobForecast = null;
        if ($forecastMonthDate) {
            $jobForecast = JobForecast::where('job_number', $jobNumber)
                ->whereYear('forecast_month', $forecastMonthDate->format('Y'))
                ->whereMonth('forecast_month', $forecastMonthDate->format('m'))
                ->first();
        }

        if (! $jobForecast && ! empty($availableForecastMonths) && ! $hasRequestedForecastMonth) {
            $jobForecast = JobForecast::where('job_number', $jobNumber)
                ->orderBy('forecast_month', 'desc')
                ->first();
            if ($jobForecast) {
                $selectedForecastMonth = date('Y-m', strtotime($jobForecast->forecast_month));
            }
        }

        $isLocked = $jobForecast ? (bool) $jobForecast->is_locked : false;

        // Workflow data
        $forecastStatus = $jobForecast?->status ?? JobForecast::STATUS_DRAFT;
        $forecastWorkflow = $jobForecast ? [
            'id' => $jobForecast->id,
            'status' => $jobForecast->status ?? JobForecast::STATUS_DRAFT,
            'statusLabel' => $jobForecast->status_label ?? 'Draft',
            'statusColor' => $jobForecast->status_color ?? 'yellow',
            'isEditable' => $jobForecast->isEditable(),
            'canSubmit' => $jobForecast->canBeSubmitted(),
            'canFinalize' => $jobForecast->canBeFinalized(),
            'canReject' => $jobForecast->canBeRejected(),
            'submittedBy' => $jobForecast->submitter?->name,
            'submittedAt' => $jobForecast->submitted_at?->format('M d, Y H:i'),
            'finalizedBy' => $jobForecast->finalizer?->name,
            'finalizedAt' => $jobForecast->finalized_at?->format('M d, Y H:i'),
            'rejectionNote' => $jobForecast->rejection_note,
            'summaryComments' => $jobForecast->summary_comments,
        ] : null;

        // Check if user is admin (can finalize)
        $canUserFinalize = Auth::user()->hasRole('admin') || Auth::user()->hasRole('backoffice');

        // Get ALL cost codes with budgets from JobReportByCostItemAndCostType
        // Join with CostCodes table to get descriptions
        $budgetData = JobReportByCostItemAndCostType::where('job_report_by_cost_items_and_cost_types.job_number', $jobNumber)
            ->leftJoin('cost_codes', 'job_report_by_cost_items_and_cost_types.cost_item', '=', 'cost_codes.code')
            ->select(
                'job_report_by_cost_items_and_cost_types.cost_item',
                'cost_codes.description as cost_item_description',
                'job_report_by_cost_items_and_cost_types.estimate_at_completion'
            )
            ->get();

        // Sum budgets by cost_item (in case there are multiple cost types per cost item)
        $budgetByCostItem = $budgetData
            ->groupBy('cost_item')
            ->map(function ($items) {
                $first = $items->first();

                return [
                    'cost_item' => $first->cost_item,
                    'cost_item_description' => $first->cost_item_description ?? '',
                    'budget' => $items->sum('estimate_at_completion'),
                ];
            });

        // Group actuals by cost_item for easy lookup
        $actualsByCostItem = $actualsByMonth->groupBy('cost_item');

        // Calculate forecast months first
        $endDate = $JobSummary->actual_end_date ?? $JobSummary->estimated_end_date ?? date('Y-m-d');
        $endMonth = date('Y-m', strtotime($endDate));
        $lastActualMonth = ! empty($months) ? end($months) : $currentMonth;

        // Forecast starts from selected forecast month (versioned forecasts)
        $startForecastMonth = $selectedForecastMonth ?: $currentMonth;

        $forecastMonths = [];
        $current = $startForecastMonth;
        while ($current <= $endMonth) {
            $forecastMonths[] = $current;
            $current = date('Y-m', strtotime($current.' +1 month'));
        }
        $overlapForecastMonths = array_values(array_intersect($forecastMonths, $months));

        // Load saved forecast data
        $savedForecasts = collect();
        if ($jobForecast) {
            $savedForecasts = JobForecastData::where('job_number', $jobNumber)
                ->where('job_forecast_id', $jobForecast->id)
                ->get()
                ->groupBy(function ($item) {
                    return $item->grid_type.'_'.$item->cost_item;
                });
        } else {
            $savedForecasts = JobForecastData::where('job_number', $jobNumber)
                ->whereNull('job_forecast_id')
                ->get()
                ->groupBy(function ($item) {
                    return $item->grid_type.'_'.$item->cost_item;
                });
        }

        // Build cost rows from ALL budget items (not just those with actuals)
        $costRows = $budgetByCostItem
            ->map(function ($budgetItem) use ($months, $actualsByCostItem, $forecastMonths, $overlapForecastMonths, $savedForecasts) {
                $costItem = $budgetItem['cost_item'];

                $row = [
                    'cost_item' => $costItem,
                    'cost_item_description' => $budgetItem['cost_item_description'],
                    'type' => 'actual',
                    'budget' => $budgetItem['budget'],
                ];

                // Initialize all months to null
                foreach ($months as $m) {
                    $row[$m] = null;
                }
                foreach ($overlapForecastMonths as $m) {
                    $row['forecast_'.$m] = null;
                }

                // Fill in actuals if they exist for this cost item
                if (isset($actualsByCostItem[$costItem])) {
                    foreach ($actualsByCostItem[$costItem] as $actualRecord) {
                        $row[$actualRecord->month] = (float) $actualRecord->actual;
                    }
                }

                // Load forecast data from saved records
                $forecastKey = 'cost_'.$costItem;
                if (isset($savedForecasts[$forecastKey])) {
                    foreach ($savedForecasts[$forecastKey] as $forecast) {
                        if (in_array($forecast->month, $forecastMonths)) {
                            if (in_array($forecast->month, $overlapForecastMonths)) {
                                $row['forecast_'.$forecast->month] = (float) $forecast->forecast_amount;
                            } else {
                                $row[$forecast->month] = (float) $forecast->forecast_amount;
                            }
                        }
                        // Get note from any month record (notes are per cost_item, stored redundantly)
                        if (! isset($row['note']) && ! empty($forecast->note)) {
                            $row['note'] = $forecast->note;
                        }
                    }
                }

                // Initialize note if not set
                if (! isset($row['note'])) {
                    $row['note'] = null;
                }

                return $row;
            })
            ->sortBy('cost_item')
            ->values()
            ->all();

        $revenueRows = [
            (function () use ($revenuesByMonth, $months, $forecastMonths, $overlapForecastMonths, $savedForecasts, $JobSummary) {
                $row = [
                    'cost_item' => '99-99',
                    'cost_item_description' => 'Revenue',
                    'contract_sum_to_date' => $JobSummary->current_estimate_revenue ?? 0,
                    'type' => 'actual',
                ];

                foreach ($months as $m) {
                    $row[$m] = null;
                }
                foreach ($overlapForecastMonths as $m) {
                    $row['forecast_'.$m] = null;
                }

                foreach ($revenuesByMonth as $r) {
                    $row[$r->month] = (float) $r->actual;
                }

                // Load forecast data from saved records
                $forecastKey = 'revenue_99-99';
                if (isset($savedForecasts[$forecastKey])) {
                    foreach ($savedForecasts[$forecastKey] as $forecast) {
                        if (in_array($forecast->month, $forecastMonths)) {
                            if (in_array($forecast->month, $overlapForecastMonths)) {
                                $row['forecast_'.$forecast->month] = (float) $forecast->forecast_amount;
                            } else {
                                $row[$forecast->month] = (float) $forecast->forecast_amount;
                            }
                        }
                        // Get note from any month record
                        if (! isset($row['note']) && ! empty($forecast->note)) {
                            $row['note'] = $forecast->note;
                        }
                    }
                }

                // Initialize note if not set
                if (! isset($row['note'])) {
                    $row['note'] = null;
                }

                return $row;
            })(),
        ];

        return Inertia::render('job-forecast/show', [
            'costRowData' => $costRows,
            'revenueRowData' => $revenueRows,
            'monthsAll' => $months,
            'projectEndMonth' => $endMonth,
            'forecastMonths' => $forecastMonths,
            'currentMonth' => $currentMonth,
            'availableForecastMonths' => $availableForecastMonths,
            'selectedForecastMonth' => $selectedForecastMonth,
            'isLocked' => $isLocked,
            'locationId' => $id,
            'jobName' => $jobName,
            'jobNumber' => $jobNumber,
            'lastUpdate' => $lastUpdate,
            // Workflow data
            'forecastWorkflow' => $forecastWorkflow,
            'canUserFinalize' => $canUserFinalize,
        ]);
    }

    /**
     * Save forecast data
     */
    public function store(Request $request, $id)
    {
        \Log::info('=== JOB FORECAST SAVE DEBUG ===');
        \Log::info('Request Data:', $request->all());
        \Log::info('Location ID:', ['id' => $id]);

        $validated = $request->validate([
            'grid_type' => 'required|in:cost,revenue',
            'forecast_month' => 'required|date_format:Y-m',
            'forecast_data' => 'required|array',
            'forecast_data.*.cost_item' => 'required|string',
            'forecast_data.*.months' => 'present|array',   // present allows empty array
            'forecast_data.*.months.*' => 'nullable|numeric',
            'forecast_data.*.note' => 'nullable|string|max:500',
        ]);

        $jobNumber = Location::where('id', $id)->value('external_id');

        // Validate that forecast amounts don't exceed budget
        $gridType = $validated['grid_type'];
        $validationErrors = [];
        $currentMonth = date('Y-m');
        $forecastMonth = $validated['forecast_month'];
        $user = Auth::user();

        $jobForecast = JobForecast::firstOrCreate(
            [
                'job_number' => $jobNumber,
                'forecast_month' => (new \DateTime($forecastMonth)),
            ],
            [
                'is_locked' => false,
                'status' => JobForecast::STATUS_DRAFT,
                'created_by' => $user->id,
            ]
        );

        // Check if forecast is editable (based on status, not just lock)
        if (! $jobForecast->isEditable()) {
            return redirect()->back()->withErrors(['error' => 'This forecast cannot be edited in its current status.']);
        }

        if ($jobForecast->is_locked) {
            return redirect()->back()->withErrors(['error' => 'This forecast is locked and cannot be edited.']);
        }

        // Update the updater
        $jobForecast->updated_by = $user->id;
        $jobForecast->save();
        foreach ($validated['forecast_data'] as $row) {
            $costItem = $row['cost_item'];

            // Get the budget for this cost item
            if ($gridType === 'cost') {
                $budget = JobReportByCostItemAndCostType::where('job_number', $jobNumber)
                    ->where('cost_item', $costItem)
                    ->sum('estimate_at_completion');
            } else {
                // For revenue, use contract sum
                $budget = ArProgressBillingSummary::where('job_number', $jobNumber)
                    ->max('contract_sum_to_date');
            }

            // Calculate actuals
            if ($gridType === 'cost') {
                $actuals = JobCostDetail::where('job_number', $jobNumber)
                    ->where('cost_item', $costItem)
                    ->sum('amount');
            } else {
                $actuals = ArProgressBillingSummary::where('job_number', $jobNumber)
                    ->sum('this_app_work_completed');
            }

            // Calculate actuals excluding current month (since current month may have incomplete actuals)
            if ($gridType === 'cost') {
                $actualsExcludingCurrentMonth = JobCostDetail::where('job_number', $jobNumber)
                    ->where('cost_item', $costItem)
                    ->whereRaw("DATE_FORMAT(transaction_date, '%Y-%m') < ?", [$currentMonth])
                    ->sum('amount');
            } else {
                $actualsExcludingCurrentMonth = ArProgressBillingSummary::where('job_number', $jobNumber)
                    ->whereRaw("DATE_FORMAT(period_end_date, '%Y-%m') < ?", [$currentMonth])
                    ->sum('this_app_work_completed');
            }

            // Calculate total forecast amount, excluding current month
            $forecastTotal = 0;
            foreach ($row['months'] as $monthKey => $amount) {
                if ($amount !== null && $amount !== '') {
                    // Strip "forecast_" prefix if present
                    $actualMonth = str_starts_with($monthKey, 'forecast_') ? substr($monthKey, 9) : $monthKey;

                    // Skip current month in validation (it's in progress and has incomplete actuals)
                    if ($actualMonth === $currentMonth) {
                        continue;
                    }

                    $forecastTotal += floatval($amount);
                }
            }

            // Check if actuals (excluding current month) + forecast (excluding current month) exceeds budget
            $total = $actualsExcludingCurrentMonth + $forecastTotal;
            $remaining = $budget - $total;

            // if ($remaining < -0.01) { // Allow small rounding errors
            //     $validationErrors[] = "Cost item {$costItem}: Total (actuals + forecast) exceeds budget by " . number_format(abs($remaining), 2);
            // }
        }

        if (! empty($validationErrors)) {
            return redirect()->back()->withErrors(['error' => implode("\n", $validationErrors)]);
        }

        DB::beginTransaction();

        try {

            foreach ($validated['forecast_data'] as $row) {
                $costItem = $row['cost_item'];
                $note = $row['note'] ?? null;

                foreach ($row['months'] as $month => $amount) {
                    // Strip "forecast_" prefix if present (for current month scenario)
                    $actualMonth = str_starts_with($month, 'forecast_') ? substr($month, 9) : $month;

                    if ($amount !== null && $amount !== '') {

                        JobForecastData::updateOrCreate(
                            [
                                'job_number' => $jobNumber,
                                'grid_type' => $gridType,
                                'cost_item' => $costItem,
                                'month' => $actualMonth,
                                'job_forecast_id' => $jobForecast->id,
                            ],
                            [
                                'location_id' => $id,
                                'forecast_amount' => $amount,
                                'note' => $note,
                            ]
                        );
                    } else {
                        // Delete the record if the value is null or empty
                        JobForecastData::where([
                            'job_number' => $jobNumber,
                            'grid_type' => $gridType,
                            'cost_item' => $costItem,
                            'month' => $actualMonth,
                            'job_forecast_id' => $jobForecast->id,
                        ])->delete();
                    }
                }
            }

            DB::commit();

            return redirect()->back()->with('success', 'Forecast saved successfully');
        } catch (\Exception $e) {
            DB::rollBack();

            \Log::error('Job forecast save failed:', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->back()->withErrors(['error' => 'Failed to save forecast: '.$e->getMessage()]);
        }
    }

    public function toggleLock(Request $request, $id)
    {
        $validated = $request->validate([
            'forecast_month' => 'required|date_format:Y-m',
            'is_locked' => 'required|boolean',
        ]);

        $jobNumber = Location::where('id', $id)->value('external_id');

        $jobForecast = JobForecast::firstOrCreate(
            [
                'job_number' => $jobNumber,
                'forecast_month' => (new \DateTime($validated['forecast_month'])),
            ],
            [
                'is_locked' => false,
            ]
        );

        $jobForecast->is_locked = (bool) $validated['is_locked'];
        $jobForecast->save();

        return redirect()->back()->with('success', $jobForecast->is_locked ? 'Forecast locked.' : 'Forecast unlocked.');
    }

    public function compareForecast($location, Request $request)
    {
        $locationModel = Location::findOrFail($location);
        $jobNumber = $locationModel->external_id;
        $locationName = $locationModel->name;
        $month = $request->query('month');
        $forecastId = $request->query('forecast_id') ? (int) $request->query('forecast_id') : null;
        $latestForecast = JobForecast::where('job_number', $jobNumber)
            ->orderBy('forecast_month', 'desc')
            ->first();
        $latestForecastMonth = $latestForecast
            ? Carbon::parse($latestForecast->forecast_month)->format('Y-m')
            : null;

        $availableForecasts = JobForecast::where('job_number', $jobNumber)
            ->orderBy('forecast_month', 'desc')
            ->get(['id', 'forecast_month', 'status'])
            ->map(fn ($f) => [
                'id' => $f->id,
                'forecast_month' => $f->forecast_month->format('Y-m'),
                'forecast_month_label' => $f->forecast_month->format('F Y'),
                'status' => $f->status,
            ]);

        if (! $month) {
            return Inertia::render('compare-forecast/show', [
                'comparisonData' => [
                    'cost' => [],
                    'revenue' => [],
                ],
                'months' => [],
                'selectedForecastMonth' => null,
                'latestForecastMonth' => $latestForecastMonth,
                'jobNumber' => $jobNumber,
                'locationId' => $location,
                'locationName' => $locationName,
                'labourSummary' => null,
                'availableForecasts' => $availableForecasts,
                'selectedForecastId' => null,
                'forecastSourceMonth' => null,
            ]);
        }

        $forecastMonth = Carbon::createFromFormat('Y-m', $month)->startOfMonth();

        if ($forecastId) {
            $jobForecast = JobForecast::with('data')
                ->where('id', $forecastId)
                ->where('job_number', $jobNumber)
                ->first();
        } else {
            $jobForecast = JobForecast::with('data')
                ->where('forecast_month', $forecastMonth->format('Y-m-d'))
                ->where('job_number', $jobNumber)
                ->first();
        }

        $forecastData = $jobForecast
            ? $jobForecast->data->groupBy(function ($item) {
                return $item->grid_type.'_'.$item->cost_item;
            })
            : collect();

        $actualsByMonth = JobCostDetail::where('job_number', $jobNumber)
            ->whereRaw("DATE_FORMAT(transaction_date, '%Y-%m') >= ?", [$month])
            ->selectRaw("
                DATE_FORMAT(transaction_date, '%Y-%m') as month,
                cost_item,
                cost_item_description,
                SUM(amount) as actual
            ")
            ->groupBy('cost_item', 'cost_item_description', 'month')
            ->orderBy('month')
            ->orderBy('cost_item')
            ->get();

        $revenuesByMonth = ArProgressBillingSummary::where('job_number', $jobNumber)
            ->whereRaw("DATE_FORMAT(period_end_date, '%Y-%m') >= ?", [$month])
            ->selectRaw("
                DATE_FORMAT(period_end_date, '%Y-%m') as month,
                '99-99' as cost_item,
                'Revenue' as cost_item_description,
                SUM(this_app_work_completed) as actual
            ")
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $costComparison = $actualsByMonth
            ->groupBy('cost_item')
            ->map(function ($items) use ($forecastData) {
                $first = $items->first();
                $months = [];

                foreach ($items as $item) {
                    $forecastAmount = null;
                    $forecastKey = 'cost_'.$item->cost_item;
                    if (isset($forecastData[$forecastKey])) {
                        $forecastRecord = $forecastData[$forecastKey]->firstWhere('month', $item->month);
                        if ($forecastRecord) {
                            $forecastAmount = (float) $forecastRecord->forecast_amount;
                        }
                    }

                    $months[$item->month] = [
                        'actual' => (float) $item->actual,
                        'forecast' => $forecastAmount,
                    ];
                }

                return [
                    'cost_item' => $first->cost_item,
                    'cost_item_description' => $first->cost_item_description ?? '',
                    'months' => $months,
                ];
            })
            ->sortBy('cost_item')
            ->values()
            ->all();

        $revenueComparison = $revenuesByMonth
            ->groupBy('cost_item')
            ->map(function ($items) use ($forecastData) {
                $first = $items->first();
                $months = [];

                foreach ($items as $item) {
                    $forecastAmount = null;
                    $forecastKey = 'revenue_'.$item->cost_item;
                    if (isset($forecastData[$forecastKey])) {
                        $forecastRecord = $forecastData[$forecastKey]->firstWhere('month', $item->month);
                        if ($forecastRecord) {
                            $forecastAmount = (float) $forecastRecord->forecast_amount;
                        }
                    }

                    $months[$item->month] = [
                        'actual' => (float) $item->actual,
                        'forecast' => $forecastAmount,
                    ];
                }

                return [
                    'cost_item' => $first->cost_item,
                    'cost_item_description' => $first->cost_item_description ?? '',
                    'months' => $months,
                ];
            })
            ->values()
            ->all();

        $months = $actualsByMonth
            ->pluck('month')
            ->merge($revenuesByMonth->pluck('month'))
            ->unique()
            ->sort()
            ->values()
            ->all();

        // Fetch labour variance summary for the selected month
        $labourSummary = null;
        try {
            // Find the approved labour forecast for this month (or the most recent one before it)
            $labourForecast = LabourForecast::where('location_id', $locationModel->id)
                ->where('status', 'approved')
                ->where('forecast_month', '<=', $forecastMonth->copy()->startOfMonth())
                ->orderBy('forecast_month', 'desc')
                ->first();

            $varianceService = new \App\Services\LabourVarianceService;
            $varianceData = $varianceService->getVarianceData(
                $locationModel,
                $forecastMonth,
                $labourForecast?->id
            );

            if ($varianceData['success'] && $varianceData['summary']) {
                $summary = $varianceData['summary'];

                // Build per-template variances from weekly data
                $templateVariances = [];
                foreach ($varianceData['variances'] as $week) {
                    foreach ($week['templates'] as $tmpl) {
                        if (abs($tmpl['cost_variance_pct']) > 15 && abs($tmpl['cost_variance']) > 1000) {
                            $templateVariances[] = [
                                'name' => $tmpl['template_name'],
                                'weekEnding' => $week['week_ending_formatted'],
                                'forecast' => $tmpl['forecast_cost'],
                                'actual' => $tmpl['actual_cost'],
                                'variance' => $tmpl['cost_variance'],
                                'variancePct' => $tmpl['cost_variance_pct'],
                            ];
                        }
                    }
                }

                // Sum leave hours from weekly data
                $totalForecastLeaveHours = 0;
                $totalActualLeaveHours = 0;
                foreach ($varianceData['variances'] as $week) {
                    $totalForecastLeaveHours += $week['totals']['forecast_leave_hours'] ?? 0;
                    $totalActualLeaveHours += $week['totals']['actual_leave_hours'] ?? 0;
                }

                $labourSummary = [
                    'headcount' => [
                        'forecast' => $summary['avg_forecast_headcount'],
                        'actual' => $summary['avg_actual_headcount'],
                    ],
                    'workedHours' => [
                        'forecast' => $summary['total_forecast_hours'],
                        'actual' => $summary['total_actual_hours'],
                    ],
                    'leaveHours' => [
                        'forecast' => round($totalForecastLeaveHours, 1),
                        'actual' => round($totalActualLeaveHours, 1),
                    ],
                    'templateVariances' => $templateVariances,
                ];
            }
        } catch (\Exception $e) {
            // Labour data is optional — don't break the page if unavailable
        }

        return Inertia::render('compare-forecast/show', [
            'comparisonData' => [
                'cost' => $costComparison,
                'revenue' => $revenueComparison,
            ],
            'months' => $months,
            'selectedForecastMonth' => $month,
            'latestForecastMonth' => $latestForecastMonth,
            'jobNumber' => $jobNumber,
            'locationId' => $location,
            'locationName' => $locationName,
            'labourSummary' => $labourSummary,
            'availableForecasts' => $availableForecasts,
            'selectedForecastId' => $forecastId,
            'forecastSourceMonth' => $jobForecast?->forecast_month?->format('Y-m'),
        ]);
    }

    /**
     * Submit forecast for review
     */
    public function submit(Request $request, $id)
    {
        $validated = $request->validate([
            'forecast_month' => 'required|date_format:Y-m',
        ]);

        $jobNumber = Location::where('id', $id)->value('external_id');
        $user = Auth::user();

        $jobForecast = JobForecast::where('job_number', $jobNumber)
            ->whereYear('forecast_month', substr($validated['forecast_month'], 0, 4))
            ->whereMonth('forecast_month', substr($validated['forecast_month'], 5, 2))
            ->first();

        if (! $jobForecast) {
            return redirect()->back()->withErrors(['error' => 'Forecast not found.']);
        }

        if (! $jobForecast->canBeSubmitted()) {
            return redirect()->back()->withErrors(['error' => 'This forecast cannot be submitted in its current status.']);
        }

        // Check if forecast has any data
        $hasData = $jobForecast->data()->exists();
        if (! $hasData) {
            return redirect()->back()->withErrors(['error' => 'Cannot submit an empty forecast. Please add forecast data first.']);
        }

        if (! $jobForecast->submit($user)) {
            return redirect()->back()->withErrors(['error' => 'Failed to submit forecast.']);
        }

        // Notify admins about the submission
        $admins = User::role(['admin', 'backoffice'])->get();
        foreach ($admins as $admin) {
            $admin->notify(new JobForecastStatusNotification($jobForecast, 'submitted', $user));
        }

        return redirect()->back()->with('success', 'Forecast submitted for review.');
    }

    /**
     * Finalize (approve) a submitted forecast
     */
    public function finalize(Request $request, $id)
    {
        $validated = $request->validate([
            'forecast_month' => 'required|date_format:Y-m',
        ]);

        $user = Auth::user();

        // Only admins can finalize
        if (! $user->hasRole('admin') && ! $user->hasRole('backoffice')) {
            return redirect()->back()->withErrors(['error' => 'You do not have permission to finalize forecasts.']);
        }

        $jobNumber = Location::where('id', $id)->value('external_id');

        $jobForecast = JobForecast::where('job_number', $jobNumber)
            ->whereYear('forecast_month', substr($validated['forecast_month'], 0, 4))
            ->whereMonth('forecast_month', substr($validated['forecast_month'], 5, 2))
            ->first();

        if (! $jobForecast) {
            return redirect()->back()->withErrors(['error' => 'Forecast not found.']);
        }

        if (! $jobForecast->canBeFinalized()) {
            return redirect()->back()->withErrors(['error' => 'This forecast cannot be finalized. It must be in submitted status.']);
        }

        if (! $jobForecast->finalize($user)) {
            return redirect()->back()->withErrors(['error' => 'Failed to finalize forecast.']);
        }

        // Notify the submitter that their forecast was finalized
        if ($jobForecast->submitter) {
            $jobForecast->submitter->notify(new JobForecastStatusNotification($jobForecast, 'finalized', $user));
        }

        // Also notify the creator if different from submitter
        if ($jobForecast->creator && $jobForecast->creator->id !== $jobForecast->submitted_by) {
            $jobForecast->creator->notify(new JobForecastStatusNotification($jobForecast, 'finalized', $user));
        }

        return redirect()->back()->with('success', 'Forecast has been finalized and locked.');
    }

    /**
     * Reject a submitted forecast (send back to draft)
     */
    public function reject(Request $request, $id)
    {
        $validated = $request->validate([
            'forecast_month' => 'required|date_format:Y-m',
            'rejection_note' => 'nullable|string|max:1000',
        ]);

        $user = Auth::user();

        // Only admins can reject
        if (! $user->hasRole('admin') && ! $user->hasRole('backoffice')) {
            return redirect()->back()->withErrors(['error' => 'You do not have permission to reject forecasts.']);
        }

        $jobNumber = Location::where('id', $id)->value('external_id');

        $jobForecast = JobForecast::where('job_number', $jobNumber)
            ->whereYear('forecast_month', substr($validated['forecast_month'], 0, 4))
            ->whereMonth('forecast_month', substr($validated['forecast_month'], 5, 2))
            ->first();

        if (! $jobForecast) {
            return redirect()->back()->withErrors(['error' => 'Forecast not found.']);
        }

        if (! $jobForecast->canBeRejected()) {
            return redirect()->back()->withErrors(['error' => 'This forecast cannot be rejected. It must be in submitted status.']);
        }

        $rejectionNote = $validated['rejection_note'] ?? null;

        if (! $jobForecast->reject($user, $rejectionNote)) {
            return redirect()->back()->withErrors(['error' => 'Failed to reject forecast.']);
        }

        // Notify the submitter that their forecast was rejected
        if ($jobForecast->creator) {
            $jobForecast->creator->notify(new JobForecastStatusNotification(
                $jobForecast,
                'rejected',
                $user,
                $rejectionNote
            ));
        }

        return redirect()->back()->with('success', 'Forecast has been rejected and sent back for revision.');
    }

    /**
     * Update forecast summary comments
     */
    public function updateSummaryComments(Request $request, $id)
    {
        $validated = $request->validate([
            'forecast_month' => 'required|date_format:Y-m',
            'summary_comments' => 'nullable|string|max:5000',
        ]);

        $jobNumber = Location::where('id', $id)->value('external_id');
        $user = Auth::user();

        $jobForecast = JobForecast::firstOrCreate(
            [
                'job_number' => $jobNumber,
                'forecast_month' => (new \DateTime($validated['forecast_month'])),
            ],
            [
                'is_locked' => false,
                'status' => JobForecast::STATUS_DRAFT,
                'created_by' => $user->id,
            ]
        );

        // Check if forecast is editable
        if (! $jobForecast->isEditable()) {
            return redirect()->back()->withErrors(['error' => 'This forecast cannot be edited in its current status.']);
        }

        $jobForecast->summary_comments = $validated['summary_comments'];
        $jobForecast->updated_by = $user->id;
        $jobForecast->save();

        return redirect()->back()->with('success', 'Summary comments updated successfully.');
    }

    /**
     * Copy forecast data from the previous month
     */
    public function copyFromPreviousMonth(Request $request, $id)
    {
        $validated = $request->validate([
            'target_month' => 'required|date_format:Y-m',
            'source_month' => 'nullable|date_format:Y-m',
        ]);

        $jobNumber = Location::where('id', $id)->value('external_id');
        $user = Auth::user();
        $targetMonth = $validated['target_month'];

        // Determine source month - either provided or previous month from target
        if (! empty($validated['source_month'])) {
            $sourceMonth = $validated['source_month'];
        } else {
            // Calculate previous month from target
            $targetDate = Carbon::createFromFormat('Y-m', $targetMonth);
            $sourceMonth = $targetDate->copy()->subMonth()->format('Y-m');
        }

        // Find source forecast
        $sourceJobForecast = JobForecast::where('job_number', $jobNumber)
            ->whereYear('forecast_month', substr($sourceMonth, 0, 4))
            ->whereMonth('forecast_month', substr($sourceMonth, 5, 2))
            ->first();

        if (! $sourceJobForecast) {
            return redirect()->back()->withErrors(['error' => 'No forecast data found for '.Carbon::createFromFormat('Y-m', $sourceMonth)->format('M Y').'.']);
        }

        // Get source forecast data
        $sourceData = JobForecastData::where('job_forecast_id', $sourceJobForecast->id)->get();

        if ($sourceData->isEmpty()) {
            return redirect()->back()->withErrors(['error' => 'No forecast data to copy from '.Carbon::createFromFormat('Y-m', $sourceMonth)->format('M Y').'.']);
        }

        // Create or get target forecast
        $targetJobForecast = JobForecast::firstOrCreate(
            [
                'job_number' => $jobNumber,
                'forecast_month' => (new \DateTime($targetMonth.'-01')),
            ],
            [
                'is_locked' => false,
                'status' => JobForecast::STATUS_DRAFT,
                'created_by' => $user->id,
            ]
        );

        // Check if target forecast is editable
        if (! $targetJobForecast->isEditable()) {
            return redirect()->back()->withErrors(['error' => 'Cannot copy to this forecast - it is not editable in its current status.']);
        }

        if ($targetJobForecast->is_locked) {
            return redirect()->back()->withErrors(['error' => 'Cannot copy to this forecast - it is locked.']);
        }

        // Check if target already has data
        $existingTargetData = JobForecastData::where('job_forecast_id', $targetJobForecast->id)->exists();

        DB::beginTransaction();
        try {
            $sourceDate = Carbon::createFromFormat('Y-m', $sourceMonth);
            $copiedCount = 0;

            foreach ($sourceData as $sourceRow) {
                // Copy the data with the same month - no shifting
                JobForecastData::updateOrCreate(
                    [
                        'job_forecast_id' => $targetJobForecast->id,
                        'grid_type' => $sourceRow->grid_type,
                        'cost_item' => $sourceRow->cost_item,
                        'month' => $sourceRow->month, // Keep the same month
                    ],
                    [
                        'job_number' => $jobNumber,
                        'location_id' => $id,
                        'forecast_amount' => $sourceRow->forecast_amount,
                    ]
                );
                $copiedCount++;
            }

            // Update the target forecast's updated_by
            $targetJobForecast->updated_by = $user->id;
            $targetJobForecast->save();

            DB::commit();

            $message = $existingTargetData
                ? "Copied {$copiedCount} forecast entries from ".$sourceDate->format('M Y').'. Existing data was merged/updated.'
                : "Copied {$copiedCount} forecast entries from ".$sourceDate->format('M Y').'.';

            return redirect()->back()->with('success', $message);
        } catch (\Exception $e) {
            DB::rollBack();

            return redirect()->back()->withErrors(['error' => 'Failed to copy forecast data: '.$e->getMessage()]);
        }
    }

    /**
     * Get aggregated labour costs by month for populating job forecast
     * This endpoint fetches approved labour forecast data and transforms it
     * into monthly costs by cost code for use in job forecast.
     */
    public function getLabourCostsForJobForecast(Location $location)
    {
        // Find the latest approved labour forecast for this location
        $labourForecast = LabourForecast::where('location_id', $location->id)
            ->where('status', LabourForecast::STATUS_APPROVED)
            ->with(['entries.template'])
            ->latest('approved_at')
            ->first();

        if (! $labourForecast) {
            return response()->json([
                'success' => false,
                'message' => 'No approved labour forecast found for this location.',
            ], 404);
        }

        // Aggregate weekly entries into monthly costs by cost code
        $monthlyCosts = [];

        \Log::info('[POPULATE-DEBUG] Starting to process labour forecast entries', [
            'forecast_id' => $labourForecast->id,
            'total_entries' => $labourForecast->entries->count(),
        ]);

        foreach ($labourForecast->entries as $entry) {
            // Get month from week_ending (e.g., "2025-11" from "2025-11-09")
            $month = $entry->week_ending->format('Y-m');

            // Get cost breakdown from snapshot
            $breakdown = $entry->cost_breakdown_snapshot;
            if (! $breakdown) {
                \Log::warning('[POPULATE-DEBUG] Entry missing cost_breakdown_snapshot', [
                    'entry_id' => $entry->id,
                    'week_ending' => $month,
                ]);

                continue;
            }

            $headcount = $entry->headcount;
            $overtimeHours = $entry->overtime_hours ?? 0;
            $leaveHours = $entry->leave_hours ?? 0;
            $rdoHours = $entry->rdo_hours ?? 0;
            $publicHolidayHours = $entry->public_holiday_not_worked_hours ?? 0;

            \Log::info('[POPULATE-DEBUG] Processing entry', [
                'entry_id' => $entry->id,
                'week_ending' => $entry->week_ending->format('Y-m-d'),
                'month' => $month,
                'headcount' => $headcount,
                'overtime_hours' => $overtimeHours,
                'leave_hours' => $leaveHours,
                'rdo_hours' => $rdoHours,
                'ph_hours' => $publicHolidayHours,
                'weekly_cost_from_entry' => $entry->weekly_cost,
            ]);

            // Include entries with ANY activity (headcount OR hours)
            if ($headcount <= 0 && $overtimeHours <= 0 && $leaveHours <= 0 && $rdoHours <= 0 && $publicHolidayHours <= 0) {
                \Log::info('[POPULATE-DEBUG] Skipping entry with no headcount or hours');

                continue;
            }

            // Get cost codes from snapshot (already calculated when forecast was created)
            // This is exactly how LabourVarianceService does it
            $costCodes = $breakdown['cost_codes'] ?? [];

            // Skip if no cost codes in snapshot (no prefix was configured when forecast was created)
            if (empty($costCodes) || empty($costCodes['wages'])) {
                continue;
            }

            // Initialize month if not exists
            if (! isset($monthlyCosts[$month])) {
                $monthlyCosts[$month] = [];
            }

            // Read cost breakdown components from snapshot exactly like LabourVarianceService does
            // IMPORTANT: The snapshot is already calculated for the entry's headcount, so don't multiply again

            \Log::info('[POPULATE-DEBUG] Snapshot total_weekly_cost', [
                'total_weekly_cost' => $breakdown['total_weekly_cost'] ?? null,
                'ordinary_marked_up' => $breakdown['ordinary']['marked_up'] ?? null,
                'overtime_marked_up' => $breakdown['overtime']['marked_up'] ?? null,
                'leave_total_cost' => $breakdown['leave']['total_cost'] ?? null,
                'rdo_total_cost' => $breakdown['rdo']['total_cost'] ?? null,
                'ph_total_cost' => $breakdown['public_holiday_not_worked']['total_cost'] ?? null,
            ]);

            // Collect oncosts from all sections and group by code
            $allOncostItems = [];
            $oncostSources = [];

            // Add worked hours oncosts
            if (isset($breakdown['oncosts']['items'])) {
                $workedOncosts = $breakdown['oncosts']['items'];
                $allOncostItems = array_merge($allOncostItems, $workedOncosts);
                $oncostSources['worked'] = count($workedOncosts);
            }

            // Add leave oncosts
            if (isset($breakdown['leave']['oncosts']['items'])) {
                $leaveOncosts = $breakdown['leave']['oncosts']['items'];
                $allOncostItems = array_merge($allOncostItems, $leaveOncosts);
                $oncostSources['leave'] = count($leaveOncosts);
            }

            // Add RDO oncosts
            if (isset($breakdown['rdo']['oncosts']['items'])) {
                $rdoOncosts = $breakdown['rdo']['oncosts']['items'];
                $allOncostItems = array_merge($allOncostItems, $rdoOncosts);
                $oncostSources['rdo'] = count($rdoOncosts);
            }

            // Add Public Holiday oncosts
            if (isset($breakdown['public_holiday_not_worked']['oncosts']['items'])) {
                $phOncosts = $breakdown['public_holiday_not_worked']['oncosts']['items'];
                $allOncostItems = array_merge($allOncostItems, $phOncosts);
                $oncostSources['ph'] = count($phOncosts);
            }

            // Group oncosts by code and sum amounts
            $groupedOncosts = [];
            foreach ($allOncostItems as $item) {
                $code = $item['code'];
                if (! isset($groupedOncosts[$code])) {
                    $groupedOncosts[$code] = 0;
                }
                $groupedOncosts[$code] += $item['amount'] ?? 0;
            }

            // Calculate total oncosts
            $totalOncosts = array_sum($groupedOncosts);

            \Log::info('[POPULATE-DEBUG] Collected oncosts', [
                'oncost_sources' => $oncostSources,
                'total_oncost_items' => count($allOncostItems),
                'grouped_oncosts' => $groupedOncosts,
                'total_oncosts_sum' => $totalOncosts,
            ]);

            // Use total_weekly_cost from snapshot as the source of truth
            // Wages = total_weekly_cost - total_oncosts
            $totalWeeklyCost = $breakdown['total_weekly_cost'] ?? 0;
            $totalWages = $totalWeeklyCost - $totalOncosts;

            \Log::info('[POPULATE-DEBUG] Calculated wages', [
                'total_weekly_cost' => $totalWeeklyCost,
                'total_oncosts' => $totalOncosts,
                'calculated_wages' => $totalWages,
            ]);

            // Wages go to the cost code from snapshot (e.g., 01-01, 03-01, etc.)
            $wagesCode = $costCodes['wages'];
            $previousWages = $monthlyCosts[$month][$wagesCode] ?? 0;
            $monthlyCosts[$month][$wagesCode] = $previousWages + $totalWages;

            \Log::info('[POPULATE-DEBUG] Adding wages to month', [
                'month' => $month,
                'wages_code' => $wagesCode,
                'previous_amount' => $previousWages,
                'adding_amount' => $totalWages,
                'new_total' => $monthlyCosts[$month][$wagesCode],
            ]);

            // Map oncost codes to cost codes from snapshot
            $onCostMappings = [
                ['cost_code' => $costCodes['super'] ?? null, 'oncost_code' => 'SUPER'],
                ['cost_code' => $costCodes['bert'] ?? null, 'oncost_code' => 'BERT'],
                ['cost_code' => $costCodes['bewt'] ?? null, 'oncost_code' => 'BEWT'],
                ['cost_code' => $costCodes['cipq'] ?? null, 'oncost_code' => 'CIPQ'],
                ['cost_code' => $costCodes['payroll_tax'] ?? null, 'oncost_code' => 'PAYROLL_TAX'],
                ['cost_code' => $costCodes['workcover'] ?? null, 'oncost_code' => 'WORKCOVER'],
            ];

            $oncostsAdded = [];
            foreach ($onCostMappings as $mapping) {
                $costCode = $mapping['cost_code'];
                if (! $costCode) {
                    continue;
                } // Skip if cost code not set

                $oncostCode = $mapping['oncost_code'];
                $value = $groupedOncosts[$oncostCode] ?? 0;
                $previousAmount = $monthlyCosts[$month][$costCode] ?? 0;
                $monthlyCosts[$month][$costCode] = $previousAmount + $value;

                $oncostsAdded[$costCode] = [
                    'oncost_type' => $oncostCode,
                    'previous' => $previousAmount,
                    'adding' => $value,
                    'new_total' => $monthlyCosts[$month][$costCode],
                ];
            }

            \Log::info('[POPULATE-DEBUG] Added oncosts to month', [
                'month' => $month,
                'oncosts' => $oncostsAdded,
            ]);
        }

        \Log::info('[POPULATE-DEBUG] Finished processing entries, monthly costs summary', [
            'months' => array_keys($monthlyCosts),
            'cost_codes_per_month' => array_map('array_keys', $monthlyCosts),
            'totals_per_month' => array_map(function ($costs) {
                return array_sum($costs);
            }, $monthlyCosts),
        ]);

        // Transform to job forecast format: array of { cost_item, months: { YYYY-MM: amount } }
        $forecastData = [];
        foreach ($monthlyCosts as $month => $costItems) {
            foreach ($costItems as $costItem => $amount) {
                if (! isset($forecastData[$costItem])) {
                    $forecastData[$costItem] = [
                        'cost_item' => $costItem,
                        'months' => [],
                    ];
                }
                $forecastData[$costItem]['months'][$month] = round($amount, 2);
            }
        }

        // Calculate summary statistics
        $totalAmount = 0;
        foreach ($forecastData as $item) {
            $totalAmount += array_sum($item['months']);
        }

        return response()->json([
            'success' => true,
            'forecast_id' => $labourForecast->id,
            'forecast_month' => $labourForecast->forecast_month->format('Y-m'),
            'approved_at' => $labourForecast->approved_at?->format('Y-m-d H:i'),
            'approved_by' => $labourForecast->approver?->name,
            'forecast_data' => array_values($forecastData),
            'summary' => [
                'total_cost_codes' => count($forecastData),
                'total_months' => count($monthlyCosts),
                'total_amount' => round($totalAmount, 2),
                'date_range' => ! empty($monthlyCosts) ? [
                    'start' => min(array_keys($monthlyCosts)),
                    'end' => max(array_keys($monthlyCosts)),
                ] : null,
            ],
        ]);
    }
}
