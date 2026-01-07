<?php

namespace App\Http\Controllers;

use App\Models\JobCostDetail;
use App\Models\Location;
use Illuminate\Http\Request;
use Inertia\Inertia;

class JobForecastController extends Controller
{
    public function show($id)
    {
        $jobNumber = Location::where('id', $id)->value('external_id');

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
        $monthlyActuals = $actualsByMonth->groupBy('month')->map(function ($items) {
            return $items->mapWithKeys(function ($item) {
                return [
                    $item->cost_item => [
                        'actual' => $item->actual,
                        'description' => $item->cost_item_description
                    ]
                ];
            });
        });
        $months = $actualsByMonth
            ->pluck('month')
            ->unique()
            ->sort()
            ->values()
            ->all();

        // Pivot into rows keyed by cost_item
        $rows = $actualsByMonth
            ->groupBy('cost_item')
            ->map(function ($items, $costItem) use ($months) {
                $first = $items->first();

                $row = [
                    'cost_item' => $costItem,
                    'cost_item_description' => $first->cost_item_description,
                    'type' => 'actual',
                    'budget' => 120000,

                ];

                // Ensure every month key exists (optional but nice)
                foreach ($months as $m) {
                    $row[$m] = null;
                }

                foreach ($items as $i) {
                    $row[$i->month] = (float) $i->actual;
                }

                return $row;
            })
            ->values()
            ->all();

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


        return Inertia::render('job-forecast/show', [
            'rowData' => $rows,
            'monthsAll' => $months,
            'forecastMonths' => $forecastMonths,
        ]);

    }
}
