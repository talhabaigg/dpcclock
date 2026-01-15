<?php

namespace App\Http\Controllers;

use App\Models\ArProgressBillingSummary;
use App\Models\JobCostDetail;
use App\Models\JobForecast;
use App\Models\JobForecastData;
use App\Models\JobReportByCostItemAndCostType;
use App\Models\JobSummary;
use App\Models\Location;
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
        if (!$user->hasRole('admin') && !$user->hasRole('backoffice')) {
            // Get accessible location IDs based on kiosk access
            $accessibleLocationIds = $user->managedKiosks()->pluck('eh_location_id')->unique()->toArray();

            // Check if this location is accessible
            if (!in_array($location->eh_location_id, $accessibleLocationIds)) {
                abort(403, 'You do not have access to this job forecast.');
            }
        }

        $jobNumber = $location->external_id;
        $jobName = $location->name ?? 'Job ' . $jobNumber;

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
        $hasRequestedForecastMonth = !empty($requestedForecastMonth);
        $selectedForecastMonth = null;
        $forecastMonthDate = null;
        if ($requestedForecastMonth) {
            $forecastMonthDate = \DateTime::createFromFormat('Y-m', $requestedForecastMonth);
            if ($forecastMonthDate && $forecastMonthDate->format('Y-m') === $requestedForecastMonth) {
                $selectedForecastMonth = $requestedForecastMonth;
            }
        }

        if (!$selectedForecastMonth) {
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

        if (!$jobForecast && !empty($availableForecastMonths) && !$hasRequestedForecastMonth) {
            $jobForecast = JobForecast::where('job_number', $jobNumber)
                ->orderBy('forecast_month', 'desc')
                ->first();
            if ($jobForecast) {
                $selectedForecastMonth = date('Y-m', strtotime($jobForecast->forecast_month));
            }
        }

        $isLocked = $jobForecast ? (bool) $jobForecast->is_locked : false;

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
        $lastActualMonth = !empty($months) ? end($months) : $currentMonth;

        // Forecast starts from selected forecast month (versioned forecasts)
        $startForecastMonth = $selectedForecastMonth ?: $currentMonth;

        $forecastMonths = [];
        $current = $startForecastMonth;
        while ($current <= $endMonth) {
            $forecastMonths[] = $current;
            $current = date('Y-m', strtotime($current . ' +1 month'));
        }
        $overlapForecastMonths = array_values(array_intersect($forecastMonths, $months));

        // Load saved forecast data
        $savedForecasts = collect();
        if ($jobForecast) {
            $savedForecasts = JobForecastData::where('job_number', $jobNumber)
                ->where('job_forecast_id', $jobForecast->id)
                ->get()
                ->groupBy(function ($item) {
                    return $item->grid_type . '_' . $item->cost_item;
                });
        } else {
            $savedForecasts = JobForecastData::where('job_number', $jobNumber)
                ->whereNull('job_forecast_id')
                ->get()
                ->groupBy(function ($item) {
                    return $item->grid_type . '_' . $item->cost_item;
                });
        }

        // Build cost rows from ALL budget items (not just those with actuals)
        $costRows = $budgetByCostItem
            ->map(function ($budgetItem) use ($months, $actualsByCostItem, $forecastMonths, $overlapForecastMonths, $savedForecasts, $currentMonth) {
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
                    $row['forecast_' . $m] = null;
                }

                // Fill in actuals if they exist for this cost item
                if (isset($actualsByCostItem[$costItem])) {
                    foreach ($actualsByCostItem[$costItem] as $actualRecord) {
                        $row[$actualRecord->month] = (float) $actualRecord->actual;
                    }
                }

                // Load forecast data from saved records
                $forecastKey = 'cost_' . $costItem;
                if (isset($savedForecasts[$forecastKey])) {
                    foreach ($savedForecasts[$forecastKey] as $forecast) {
                        if (in_array($forecast->month, $forecastMonths)) {
                            if (in_array($forecast->month, $overlapForecastMonths)) {
                                $row['forecast_' . $forecast->month] = (float) $forecast->forecast_amount;
                            } else {
                                $row[$forecast->month] = (float) $forecast->forecast_amount;
                            }
                        }
                    }
                }

                return $row;
            })
            ->sortBy('cost_item')
            ->values()
            ->all();

        $revenueRows = [
            (function () use ($revenuesByMonth, $months, $forecastMonths, $overlapForecastMonths, $savedForecasts, $currentMonth) {
                $row = [
                    'cost_item' => '99-99',
                    'cost_item_description' => 'Revenue',
                    'contract_sum_to_date' => $revenuesByMonth->max('contract_sum_to_date'),
                    'type' => 'actual',
                ];

                foreach ($months as $m) {
                    $row[$m] = null;
                }
                foreach ($overlapForecastMonths as $m) {
                    $row['forecast_' . $m] = null;
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
                                $row['forecast_' . $forecast->month] = (float) $forecast->forecast_amount;
                            } else {
                                $row[$forecast->month] = (float) $forecast->forecast_amount;
                            }
                        }
                    }
                }

                return $row;
            })()
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
        ]);

        $jobNumber = Location::where('id', $id)->value('external_id');

        // Validate that forecast amounts don't exceed budget
        $gridType = $validated['grid_type'];
        $validationErrors = [];
        $currentMonth = date('Y-m');
        $forecastMonth = $validated['forecast_month'];
        $jobForecast = JobForecast::firstOrCreate(
            [
                'job_number' => $jobNumber,
                'forecast_month' => (new \DateTime($forecastMonth)),
            ],
            [
                'is_locked' => false,
            ]
        );

        if ($jobForecast->is_locked) {
            return redirect()->back()->withErrors(['error' => 'This forecast is locked and cannot be edited.']);
        }
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

            if ($remaining < -0.01) { // Allow small rounding errors
                $validationErrors[] = "Cost item {$costItem}: Total (actuals + forecast) exceeds budget by " . number_format(abs($remaining), 2);
            }
        }

        if (!empty($validationErrors)) {
            return redirect()->back()->withErrors(['error' => implode("\n", $validationErrors)]);
        }

        DB::beginTransaction();

        try {

            foreach ($validated['forecast_data'] as $row) {
                $costItem = $row['cost_item'];

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
                'trace' => $e->getTraceAsString()
            ]);

            return redirect()->back()->withErrors(['error' => 'Failed to save forecast: ' . $e->getMessage()]);
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

}
