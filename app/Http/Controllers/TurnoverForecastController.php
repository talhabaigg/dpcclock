<?php

namespace App\Http\Controllers;

use App\Models\ArProgressBillingSummary;
use App\Models\CompanyMonthlyRevenueTarget;
use App\Models\ForecastProject;
use App\Models\JobCostDetail;
use App\Models\JobForecast;
use App\Models\JobForecastData;
use App\Models\JobReportByCostItemAndCostType;
use App\Models\JobSummary;
use App\Models\LabourForecast;
use App\Models\Location;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class TurnoverForecastController extends Controller
{
    private function generateMonthRange($startMonth, $endMonth)
    {
        $months = [];
        $current = $startMonth;

        while ($current <= $endMonth) {
            $months[] = $current;
            $current = date('Y-m', strtotime($current.'-01 +1 month'));
        }

        return $months;
    }

    public function index()
    {
        // Get the current financial year (July to June)
        $now = now();
        $currentMonth = $now->month;
        $currentYear = $now->year;
        $currentForecastMonth = $now;

        // FY starts in July (month 7)
        if ($currentMonth >= 7) {
            $fyStartYear = $currentYear;
            $fyEndYear = $currentYear + 1;
        } else {
            $fyStartYear = $currentYear - 1;
            $fyEndYear = $currentYear;
        }

        $fyStartDate = "$fyStartYear-07-01";
        $fyEndDate = "$fyEndYear-06-30";

        // Get all locations with job numbers, filtered by kiosk access
        $user = Auth::user();
        $locationsQuery = Location::open()->where(function ($query) {
            $query->where('eh_parent_id', 1198645)->orWhere('eh_parent_id', 1249093);
        })->whereNotNull('external_id');

        // Filter by kiosk access if user is not admin or backoffice
        if (! $user->hasRole('admin') && ! $user->hasRole('backoffice')) {
            $accessibleLocationIds = $user->managedKiosks()->pluck('eh_location_id')->unique()->toArray();
            $locationsQuery->whereIn('eh_location_id', $accessibleLocationIds);
        }

        $locations = $locationsQuery->select('id', 'name', 'external_id', 'eh_parent_id')->get();
        $jobNumbers = $locations->pluck('external_id')->toArray();
        $locationIds = $locations->pluck('id')->toArray();

        // Get forecast projects - hide them if user has restricted access (not admin or backoffice)
        $forecastProjects = collect([]);
        if ($user->hasRole('admin') || $user->hasRole('backoffice')) {
            $forecastProjects = ForecastProject::with(['costItems', 'revenueItems'])->get();
        }

        // ============ BATCH LOAD ALL DATA ============

        // JobReportByCostItemAndCostType: budget (estimate_at_completion) and project_manager per job
        $budgetsByJob = JobReportByCostItemAndCostType::whereIn('job_number', $jobNumbers)
            ->groupBy('job_number')
            ->select('job_number', DB::raw('SUM(estimate_at_completion) as budget'))
            ->pluck('budget', 'job_number');

        $projectManagersByJob = JobReportByCostItemAndCostType::whereIn('job_number', $jobNumbers)
            ->groupBy('job_number')
            ->select('job_number', DB::raw('MIN(project_manager) as project_manager'))
            ->pluck('project_manager', 'job_number');

        // JobSummary: current_estimate_revenue (max) and over_under_billing (max) per job
        $jobSummariesByJob = JobSummary::whereIn('job_number', $jobNumbers)
            ->groupBy('job_number')
            ->select(
                'job_number',
                DB::raw('MAX(current_estimate_revenue) as current_estimate_revenue'),
                DB::raw('MAX(over_under_billing) as over_under_billing')
            )
            ->get()
            ->keyBy('job_number');

        // JobCostDetail: cost_to_date (total amount) per job
        $costToDateByJob = JobCostDetail::whereIn('job_number', $jobNumbers)
            ->groupBy('job_number')
            ->select('job_number', DB::raw('SUM(amount) as cost_to_date'))
            ->pluck('cost_to_date', 'job_number');

        // JobCostDetail: monthly cost actuals per job
        $monthlyCostActuals = JobCostDetail::whereIn('job_number', $jobNumbers)
            ->selectRaw("job_number, DATE_FORMAT(transaction_date, '%Y-%m') as month, SUM(amount) as amount")
            ->groupBy('job_number', 'month')
            ->orderBy('month')
            ->get()
            ->groupBy('job_number')
            ->map(fn ($rows) => $rows->pluck('amount', 'month')->toArray());

        // JobCostDetail: cost actuals this FY per job
        $costActualsFYByJob = JobCostDetail::whereIn('job_number', $jobNumbers)
            ->whereBetween('transaction_date', [$fyStartDate, $fyEndDate])
            ->groupBy('job_number')
            ->select('job_number', DB::raw('SUM(amount) as amount'))
            ->pluck('amount', 'job_number');

        // ArProgressBillingSummary: claimed_to_date per job
        $claimedToDateByJob = ArProgressBillingSummary::whereIn('job_number', $jobNumbers)
            ->groupBy('job_number')
            ->select('job_number', DB::raw('SUM(this_app_work_completed) as claimed_to_date'))
            ->pluck('claimed_to_date', 'job_number');

        // ArProgressBillingSummary: claimed actuals this FY per job
        $claimedActualsFYByJob = ArProgressBillingSummary::whereIn('job_number', $jobNumbers)
            ->whereBetween('period_end_date', [$fyStartDate, $fyEndDate])
            ->groupBy('job_number')
            ->select('job_number', DB::raw('SUM(this_app_work_completed) as amount'))
            ->pluck('amount', 'job_number');

        // ArProgressBillingSummary: monthly revenue actuals per job
        $monthlyRevenueActuals = ArProgressBillingSummary::whereIn('job_number', $jobNumbers)
            ->selectRaw("job_number, DATE_FORMAT(period_end_date, '%Y-%m') as month, SUM(this_app_work_completed) as amount")
            ->groupBy('job_number', 'month')
            ->orderBy('month')
            ->get()
            ->groupBy('job_number')
            ->map(fn ($rows) => $rows->pluck('amount', 'month')->toArray());

        // JobForecast: get current month forecasts and fallback latest forecasts per job
        $currentMonthForecasts = JobForecast::whereIn('job_number', $jobNumbers)
            ->whereYear('forecast_month', $currentForecastMonth->year)
            ->whereMonth('forecast_month', $currentForecastMonth->month)
            ->orderBy('forecast_month', 'desc')
            ->get()
            ->unique('job_number')
            ->keyBy('job_number');

        // For jobs without a current-month forecast, get the latest forecast
        $jobsNeedingFallback = collect($jobNumbers)->diff($currentMonthForecasts->keys());
        $fallbackForecasts = collect();
        if ($jobsNeedingFallback->isNotEmpty()) {
            $fallbackForecasts = JobForecast::whereIn('job_number', $jobsNeedingFallback->values())
                ->orderBy('forecast_month', 'desc')
                ->get()
                ->unique('job_number')
                ->keyBy('job_number');
        }

        // Merge: current month forecast takes priority, fallback for the rest
        $forecastsByJob = $currentMonthForecasts->union($fallbackForecasts);
        $forecastIdsByJob = $forecastsByJob->map(fn ($f) => $f->id);

        // JobForecastData: batch load all forecast data for resolved forecast IDs
        $allForecastIds = $forecastIdsByJob->values()->filter()->toArray();
        $allForecastData = collect();
        if (! empty($allForecastIds)) {
            $allForecastData = JobForecastData::whereIn('job_forecast_id', $allForecastIds)
                ->whereIn('job_number', $jobNumbers)
                ->select('job_number', 'job_forecast_id', 'grid_type', 'month', DB::raw('SUM(forecast_amount) as amount'))
                ->groupBy('job_number', 'job_forecast_id', 'grid_type', 'month')
                ->orderBy('month')
                ->get();
        }

        // Index forecast data by job_number -> grid_type -> month
        $forecastDataByJob = [];
        foreach ($allForecastData as $row) {
            $forecastDataByJob[$row->job_number][$row->grid_type][$row->month] = (float) $row->amount;
        }

        // LabourForecast: get latest approved forecast per location with entries
        $labourForecasts = LabourForecast::whereIn('location_id', $locationIds)
            ->where('status', LabourForecast::STATUS_APPROVED)
            ->with('entries')
            ->orderBy('forecast_month', 'desc')
            ->get()
            ->unique('location_id')
            ->keyBy('location_id');

        // JobForecastData for forecast projects: batch load
        $forecastProjectIds = $forecastProjects->pluck('id')->toArray();
        $forecastProjectData = collect();
        if (! empty($forecastProjectIds)) {
            $forecastProjectData = JobForecastData::whereIn('forecast_project_id', $forecastProjectIds)
                ->select('forecast_project_id', 'grid_type', 'month', DB::raw('SUM(forecast_amount) as amount'))
                ->groupBy('forecast_project_id', 'grid_type', 'month')
                ->orderBy('month')
                ->get();
        }

        // Index forecast project data by project_id -> grid_type -> month
        $forecastProjectDataByProject = [];
        foreach ($forecastProjectData as $row) {
            $forecastProjectDataByProject[$row->forecast_project_id][$row->grid_type][$row->month] = (float) $row->amount;
        }

        // ============ BUILD COMBINED DATA ============
        $combinedData = [];
        $earliestActualMonth = null;
        $latestForecastMonth = null;
        $fyMonths = $this->generateMonthRange(date('Y-m', strtotime($fyStartDate)), date('Y-m', strtotime($fyEndDate)));
        $currentMonthStr = date('Y-m');

        // Process actual locations (no more per-job queries)
        foreach ($locations as $location) {
            $jobNumber = $location->external_id;

            $budget = (float) ($budgetsByJob[$jobNumber] ?? 0);
            $projectManager = $projectManagersByJob[$jobNumber] ?? 'Not Assigned';

            $jobSummary = $jobSummariesByJob[$jobNumber] ?? null;
            $currentEstimateRevenue = (float) ($jobSummary?->current_estimate_revenue ?? 0);
            $over_under_billing = (float) ($jobSummary?->over_under_billing ?? 0);
            $totalContractValue = $currentEstimateRevenue;

            $costToDate = (float) ($costToDateByJob[$jobNumber] ?? 0);
            $costActuals = $monthlyCostActuals[$jobNumber] ?? [];
            $costActualsFY = (float) ($costActualsFYByJob[$jobNumber] ?? 0);

            $claimedToDate = (float) ($claimedToDateByJob[$jobNumber] ?? 0);
            $claimedActualsFY = (float) ($claimedActualsFYByJob[$jobNumber] ?? 0);
            $revenueActuals = $monthlyRevenueActuals[$jobNumber] ?? [];

            // Forecast data
            $currentJobForecast = $forecastsByJob[$jobNumber] ?? null;
            $costForecast = $forecastDataByJob[$jobNumber]['cost'] ?? [];
            $revenueForecast = $forecastDataByJob[$jobNumber]['revenue'] ?? [];

            // Track earliest actual month
            $allActualMonthKeys = array_merge(array_keys($costActuals), array_keys($revenueActuals));
            if (! empty($allActualMonthKeys)) {
                $firstMonth = min($allActualMonthKeys);
                if ($earliestActualMonth === null || $firstMonth < $earliestActualMonth) {
                    $earliestActualMonth = $firstMonth;
                }
            }

            // Track latest forecast month
            if (! empty($costForecast) || ! empty($revenueForecast)) {
                $lastForecast = max(
                    ! empty($costForecast) ? max(array_keys($costForecast)) : '0000-00',
                    ! empty($revenueForecast) ? max(array_keys($revenueForecast)) : '0000-00'
                );
                if ($latestForecastMonth === null || $lastForecast > $latestForecastMonth) {
                    $latestForecastMonth = $lastForecast;
                }
            }

            // Revenue contract FY: prefer actuals over forecasts per month
            $revenueContractFY = 0;
            foreach ($fyMonths as $month) {
                if (isset($revenueActuals[$month]) && $revenueActuals[$month] != 0) {
                    $revenueContractFY += $revenueActuals[$month];
                } elseif (isset($revenueForecast[$month])) {
                    $revenueContractFY += $revenueForecast[$month];
                }
            }

            $remainingRevenueValueFY = $revenueContractFY - $claimedActualsFY;
            $remainingOrderBook = $totalContractValue - $claimedToDate;

            // Cost contract FY: past months prefer actuals, current/future prefer forecast
            $costContractFY = 0;
            foreach ($fyMonths as $month) {
                if ($month < $currentMonthStr) {
                    if (isset($costActuals[$month]) && $costActuals[$month] != 0) {
                        $costContractFY += $costActuals[$month];
                    } elseif (isset($costForecast[$month])) {
                        $costContractFY += $costForecast[$month];
                    }
                } else {
                    if (isset($costForecast[$month]) && $costForecast[$month] != 0) {
                        $costContractFY += $costForecast[$month];
                    } elseif (isset($costActuals[$month])) {
                        $costContractFY += $costActuals[$month];
                    }
                }
            }

            $remainingCostValueFY = $costContractFY - $costActualsFY;
            $remainingBudget = $budget - $costToDate;

            // Labour forecast headcount
            $labourForecastHeadcount = [];
            $latestApprovedForecast = $labourForecasts[$location->id] ?? null;
            if ($latestApprovedForecast) {
                $monthlyWeekCounts = [];

                foreach ($latestApprovedForecast->entries as $entry) {
                    $monthKey = $entry->week_ending->format('Y-m');
                    $weekKey = $entry->week_ending->format('Y-m-d');

                    if (! isset($monthlyWeekCounts[$monthKey])) {
                        $monthlyWeekCounts[$monthKey] = [];
                    }
                    if (! isset($monthlyWeekCounts[$monthKey][$weekKey])) {
                        $monthlyWeekCounts[$monthKey][$weekKey] = 0;
                    }
                    $monthlyWeekCounts[$monthKey][$weekKey] += (float) $entry->headcount;
                }

                foreach ($monthlyWeekCounts as $month => $weeks) {
                    $weekCount = count($weeks);
                    if ($weekCount > 0) {
                        $labourForecastHeadcount[$month] = array_sum($weeks) / $weekCount;
                    }
                }
            }

            // Forecast status
            $forecastStatus = 'not_started';
            $lastSubmittedAt = null;
            if ($currentJobForecast) {
                $forecastStatus = match ($currentJobForecast->status) {
                    JobForecast::STATUS_PENDING => 'not_started',
                    JobForecast::STATUS_DRAFT => 'draft',
                    JobForecast::STATUS_SUBMITTED => 'submitted',
                    JobForecast::STATUS_FINALIZED => 'finalized',
                    default => 'not_started',
                };
                $lastSubmittedAt = $currentJobForecast->submitted_at?->toIso8601String();
            }

            // Calculated total revenue (actuals preferred over forecasts per month)
            $allMonthsSet = array_unique(array_merge(
                array_keys($revenueActuals),
                array_keys($revenueForecast)
            ));
            $calculatedTotalRevenue = 0;
            foreach ($allMonthsSet as $month) {
                $actualVal = $revenueActuals[$month] ?? 0;
                $forecastVal = $revenueForecast[$month] ?? 0;
                $calculatedTotalRevenue += ($actualVal != 0) ? $actualVal : $forecastVal;
            }

            // Determine company from eh_parent_id
            $company = match ((int) $location->eh_parent_id) {
                1198645 => 'GRE',
                1249093 => 'SWCP',
                default => 'Unknown',
            };

            $combinedData[] = [
                'id' => $location->id,
                'type' => 'location',
                'company' => $company,
                'job_name' => $location->name,
                'job_number' => $jobNumber,
                'project_manager' => $projectManager,
                'over_under_billing' => $over_under_billing,
                'forecast_status' => $forecastStatus,
                'last_submitted_at' => $lastSubmittedAt,
                'current_estimate_revenue' => $currentEstimateRevenue,
                'current_estimate_cost' => $budget,
                'claimed_to_date' => $claimedToDate,
                'revenue_contract_fy' => (float) $revenueContractFY,
                'total_contract_value' => $totalContractValue,
                'calculated_total_revenue' => (float) $calculatedTotalRevenue,
                'revenue_variance' => (float) ($calculatedTotalRevenue - $totalContractValue),
                'remaining_revenue_value_fy' => (float) $remainingRevenueValueFY,
                'remaining_order_book' => (float) $remainingOrderBook,
                'cost_to_date' => $costToDate,
                'cost_contract_fy' => (float) $costContractFY,
                'budget' => $budget,
                'remaining_cost_value_fy' => (float) $remainingCostValueFY,
                'remaining_budget' => (float) $remainingBudget,
                'revenue_actuals' => $revenueActuals,
                'revenue_forecast' => $revenueForecast,
                'cost_actuals' => $costActuals,
                'cost_forecast' => $costForecast,
                'labour_forecast_headcount' => $labourForecastHeadcount,
            ];
        }

        // Process forecast projects
        foreach ($forecastProjects as $project) {
            $budget = $project->costItems->sum('estimate_at_completion');
            $totalContractValue = $project->revenueItems->sum('contract_sum_to_date');

            $costForecast = $forecastProjectDataByProject[$project->id]['cost'] ?? [];
            $revenueForecast = $forecastProjectDataByProject[$project->id]['revenue'] ?? [];

            // Track latest forecast month
            if (! empty($costForecast) || ! empty($revenueForecast)) {
                $lastForecast = max(
                    ! empty($costForecast) ? max(array_keys($costForecast)) : '0000-00',
                    ! empty($revenueForecast) ? max(array_keys($revenueForecast)) : '0000-00'
                );
                if ($latestForecastMonth === null || $lastForecast > $latestForecastMonth) {
                    $latestForecastMonth = $lastForecast;
                }
            }

            // Revenue FY calculations (no actuals for forecast projects)
            $revenueContractFY = 0;
            foreach ($revenueForecast as $month => $amount) {
                if (
                    $month >= date('Y-m', strtotime($fyStartDate)) &&
                    $month <= date('Y-m', strtotime($fyEndDate))
                ) {
                    $revenueContractFY += $amount;
                }
            }
            $remainingRevenueValueFY = $revenueContractFY;
            $remainingOrderBook = $totalContractValue;

            // Cost FY calculations (no actuals for forecast projects)
            $costContractFY = 0;
            foreach ($costForecast as $month => $amount) {
                if (
                    $month >= date('Y-m', strtotime($fyStartDate)) &&
                    $month <= date('Y-m', strtotime($fyEndDate))
                ) {
                    $costContractFY += $amount;
                }
            }
            $remainingCostValueFY = $costContractFY;
            $remainingBudget = $budget;

            $forecastProjectStatus = match ($project->status) {
                'pending' => 'not_started',
                'draft' => 'draft',
                'submitted' => 'submitted',
                'finalized' => 'finalized',
                default => 'not_started',
            };

            $calculatedTotalRevenue = array_sum($revenueForecast);

            $combinedData[] = [
                'id' => $project->id,
                'type' => 'forecast_project',
                'company' => 'Forecast',
                'job_name' => $project->name,
                'job_number' => $project->project_number,
                'forecast_status' => $forecastProjectStatus,
                'last_submitted_at' => null,
                'claimed_to_date' => 0,
                'current_estimate_revenue' => 0,
                'revenue_contract_fy' => (float) $revenueContractFY,
                'total_contract_value' => (float) $totalContractValue,
                'calculated_total_revenue' => (float) $calculatedTotalRevenue,
                'revenue_variance' => (float) ($calculatedTotalRevenue - $totalContractValue),
                'remaining_revenue_value_fy' => (float) $remainingRevenueValueFY,
                'remaining_order_book' => (float) $remainingOrderBook,
                'cost_to_date' => 0,
                'cost_contract_fy' => (float) $costContractFY,
                'budget' => (float) $budget,
                'remaining_cost_value_fy' => (float) $remainingCostValueFY,
                'remaining_budget' => (float) $remainingBudget,
                'revenue_actuals' => [],
                'revenue_forecast' => $revenueForecast,
                'cost_actuals' => [],
                'cost_forecast' => $costForecast,
                'labour_forecast_headcount' => [],
            ];
        }

        // Generate complete month range from earliest actual to latest forecast
        $startMonth = $earliestActualMonth ?? date('Y-m');
        $endMonth = $latestForecastMonth ?? date('Y-m');

        if ($earliestActualMonth && ! $latestForecastMonth) {
            $endMonth = date('Y-m', strtotime('+12 months'));
        }

        $allMonths = $this->generateMonthRange($startMonth, $endMonth);

        $monthlyTargets = CompanyMonthlyRevenueTarget::whereIn('month', $allMonths)
            ->get()
            ->pluck('target_amount', 'month')
            ->map(fn ($amount) => (float) $amount)
            ->toArray();

        // Determine the last actual month globally (for coloring columns)
        $lastActualMonthGlobal = null;
        foreach ($combinedData as $row) {
            if (! empty($row['revenue_actuals'])) {
                $lastActual = max(array_keys($row['revenue_actuals']));
                if ($lastActualMonthGlobal === null || $lastActual > $lastActualMonthGlobal) {
                    $lastActualMonthGlobal = $lastActual;
                }
            }
            if (! empty($row['cost_actuals'])) {
                $lastActual = max(array_keys($row['cost_actuals']));
                if ($lastActualMonthGlobal === null || $lastActual > $lastActualMonthGlobal) {
                    $lastActualMonthGlobal = $lastActual;
                }
            }
        }

        return Inertia::render('turnover-forecast/index', [
            'data' => $combinedData,
            'months' => $allMonths,
            'earliestMonth' => $earliestActualMonth,
            'lastActualMonth' => $lastActualMonthGlobal,
            'latestForecastMonth' => $latestForecastMonth,
            'fyStartDate' => $fyStartDate,
            'fyEndDate' => $fyEndDate,
            'fyLabel' => "FY{$fyStartYear}-".substr($fyEndYear, 2, 2),
            'monthlyTargets' => $monthlyTargets,
        ]);
    }
}
