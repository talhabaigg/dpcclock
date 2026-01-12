<?php

namespace App\Http\Controllers;

use App\Models\ArProgressBillingSummary;
use App\Models\JobCostDetail;
use App\Models\JobForecastData;
use App\Models\JobReportByCostItemAndCostType;
use App\Models\Location;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class JobForecastController extends Controller
{
    public function show($id)
    {
        $location = Location::where('id', $id)->first();

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

        $budget = JobReportByCostItemAndCostType::where('job_number', $jobNumber)->select('cost_item', 'estimate_at_completion')->get();
        // dd($budget);
        // Sum actuals by cost_item
        $sumByCostItem = $budget
            ->groupBy('cost_item')
            ->map(function ($items, $costItem) {
                return [
                    'cost_item' => $costItem,
                    'estimate_at_completion' => $items->sum('estimate_at_completion'),
                ];
            })
            ->values()
            ->all();




        // Calculate forecast months first
        $endDate = '2026-05-20';
        $endMonth = date('Y-m', strtotime($endDate));
        $lastActualMonth = end($months);

        // Forecast starts from the month AFTER the last actual month
        $startForecastMonth = date('Y-m', strtotime($lastActualMonth . ' +1 month'));

        $forecastMonths = [];
        $current = $startForecastMonth;
        while ($current <= $endMonth) {
            $forecastMonths[] = $current;
            $current = date('Y-m', strtotime($current . ' +1 month'));
        }

        // Load saved forecast data
        $savedForecasts = JobForecastData::where('job_number', $jobNumber)
            ->get()
            ->groupBy(function ($item) {
                return $item->grid_type . '_' . $item->cost_item;
            });

        $costRows = $actualsByMonth
            ->groupBy('cost_item')
            ->map(function ($items, $costItem) use ($months, $sumByCostItem, $forecastMonths, $savedForecasts) {
                $first = $items->first();

                $row = [
                    'cost_item' => $costItem,
                    'cost_item_description' => $first->cost_item_description,
                    'type' => 'actual',
                    'budget' => collect($sumByCostItem)
                        ->where('cost_item', $costItem)
                        ->pluck('estimate_at_completion')
                        ->first() ?? 0,
                ];

                foreach ($months as $m) {
                    $row[$m] = null;
                }

                foreach ($items as $i) {
                    $row[$i->month] = (float) $i->actual;
                }

                // Load forecast data from saved records
                $forecastKey = 'cost_' . $costItem;
                if (isset($savedForecasts[$forecastKey])) {
                    foreach ($savedForecasts[$forecastKey] as $forecast) {
                        if (in_array($forecast->month, $forecastMonths)) {
                            $row[$forecast->month] = (float) $forecast->forecast_amount;
                        }
                    }
                }

                return $row;
            })
            ->values()
            ->all();

        $revenueRows = [
            (function () use ($revenuesByMonth, $months, $forecastMonths, $savedForecasts) {
                $row = [
                    'cost_item' => '99-99',
                    'cost_item_description' => 'Revenue',
                    'contract_sum_to_date' => $revenuesByMonth->max('contract_sum_to_date'),
                    'type' => 'actual',
                ];

                foreach ($months as $m) {
                    $row[$m] = null;
                }

                foreach ($revenuesByMonth as $r) {
                    $row[$r->month] = (float) $r->actual;
                }

                // Load forecast data from saved records
                $forecastKey = 'revenue_99-99';
                if (isset($savedForecasts[$forecastKey])) {
                    foreach ($savedForecasts[$forecastKey] as $forecast) {
                        if (in_array($forecast->month, $forecastMonths)) {
                            $row[$forecast->month] = (float) $forecast->forecast_amount;
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
            'forecast_data' => 'required|array',
            'forecast_data.*.cost_item' => 'required|string',
            'forecast_data.*.months' => 'present|array',   // present allows empty array
            'forecast_data.*.months.*' => 'nullable|numeric',
        ]);

        $jobNumber = Location::where('id', $id)->value('external_id');

        // Validate that forecast amounts don't exceed budget
        $gridType = $validated['grid_type'];
        $validationErrors = [];

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

            // Calculate total forecast amount
            $forecastTotal = 0;
            foreach ($row['months'] as $amount) {
                if ($amount !== null && $amount !== '') {
                    $forecastTotal += floatval($amount);
                }
            }

            // Check if actuals + forecast exceeds budget
            $total = $actuals + $forecastTotal;
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
                    if ($amount !== null && $amount !== '') {
                        JobForecastData::updateOrCreate(
                            [
                                'job_number' => $jobNumber,
                                'grid_type' => $gridType,
                                'cost_item' => $costItem,
                                'month' => $month,
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
                            'month' => $month,
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

}
