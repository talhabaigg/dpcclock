<?php

namespace App\Http\Controllers;

use App\Models\ArProgressBillingSummary;
use App\Models\JobCostDetail;
use App\Models\JobForecastData;
use App\Models\JobReportByCostItemAndCostType;
use App\Models\Location;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class JobForecastController extends Controller
{
    public function show($id)
    {
        $location = Location::where('id', $id)->first();
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
        $endDate = '2026-09-01';
        $endMonth = date('Y-m', strtotime($endDate));
        $lastActualMonth = end($months);
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

        DB::beginTransaction();
        try {
            $gridType = $validated['grid_type'];

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
