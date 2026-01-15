<?php

namespace App\Http\Controllers;

use App\Models\ArProgressBillingSummary;
use App\Models\ForecastProject;
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

class TurnoverForecastController extends Controller
{
    private function generateMonthRange($startMonth, $endMonth)
    {
        $months = [];
        $current = $startMonth;

        while ($current <= $endMonth) {
            $months[] = $current;
            $current = date('Y-m', strtotime($current . '-01 +1 month'));
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
        $locationsQuery = Location::where(function ($query) {
            $query->where('eh_parent_id', 1198645)->orWhere('eh_parent_id', 1249093);
        })->whereNotNull('external_id');

        // Filter by kiosk access if user is not admin or backoffice
        if (!$user->hasRole('admin') && !$user->hasRole('backoffice')) {
            // Get location IDs where user has kiosk access (using eh_location_id from kiosks table)
            $accessibleLocationIds = $user->managedKiosks()->pluck('eh_location_id')->unique()->toArray();
            $locationsQuery->whereIn('eh_location_id', $accessibleLocationIds);
        }

        $locations = $locationsQuery->select('id', 'name', 'external_id')->get();

        // Get forecast projects - hide them if user has restricted access (not admin or backoffice)
        $forecastProjects = collect([]);
        if ($user->hasRole('admin') || $user->hasRole('backoffice')) {
            $forecastProjects = ForecastProject::with(['costItems', 'revenueItems'])->get();
        }

        // Build combined data
        $combinedData = [];
        $earliestActualMonth = null;
        $latestForecastMonth = null;

        // Process actual locations
        foreach ($locations as $location) {
            $jobNumber = $location->external_id;

            // ============ COST DATA ============
            // Budget (estimate at completion)
            $budget = JobReportByCostItemAndCostType::where('job_number', $jobNumber)
                ->sum('estimate_at_completion');

            // ============ Current Revenue ============
            $currentEstimateRevenue = JobSummary::where('job_number', $jobNumber)
                ->max('current_estimate_revenue') ?? 0;

            // Cost to date (sum of all job cost details)
            $costToDate = JobCostDetail::where('job_number', $jobNumber)
                ->sum('amount');

            // Load project manager name
            $projectManager = JobReportByCostItemAndCostType::where('job_number', $jobNumber)->value('project_manager') ?? "Not Assigned";

            // Load Over Under Billing
            $over_under_billing = JobSummary::where('job_number', $jobNumber)
                ->max('over_under_billing') ?? 0;

            // Get monthly cost actuals
            $costActuals = JobCostDetail::where('job_number', $jobNumber)
                ->selectRaw("DATE_FORMAT(transaction_date, '%Y-%m') as month, SUM(amount) as amount")
                ->groupBy('month')
                ->orderBy('month')
                ->get()
                ->pluck('amount', 'month')
                ->toArray();

            // ============ REVENUE DATA ============
            // Claimed to date (sum of all billing)
            $claimedToDate = ArProgressBillingSummary::where('job_number', $jobNumber)
                ->sum('this_app_work_completed');

            // Total contract value (latest contract sum)
            $totalContractValue = JobSummary::where('job_number', $jobNumber)
                ->max('current_estimate_revenue') ?? 0;

            // Claimed actuals this FY
            $claimedActualsFY = ArProgressBillingSummary::where('job_number', $jobNumber)
                ->whereBetween('period_end_date', [$fyStartDate, $fyEndDate])
                ->sum('this_app_work_completed');

            // Get monthly actuals (revenue)
            $revenueActuals = ArProgressBillingSummary::where('job_number', $jobNumber)
                ->selectRaw("DATE_FORMAT(period_end_date, '%Y-%m') as month, SUM(this_app_work_completed) as amount")
                ->groupBy('month')
                ->orderBy('month')
                ->get()
                ->pluck('amount', 'month')
                ->toArray();



            // ============ FORECAST DATA ============
            // Find last actual month across both cost and revenue
            $lastCostMonth = !empty($costActuals) ? max(array_keys($costActuals)) : null;
            $lastRevenueMonth = !empty($revenueActuals) ? max(array_keys($revenueActuals)) : null;
            $lastActualMonth = max($lastCostMonth, $lastRevenueMonth);

            // Track global earliest and determine latest forecast month
            if (!empty($costActuals) || !empty($revenueActuals)) {
                $firstMonth = min(
                    !empty($costActuals) ? min(array_keys($costActuals)) : '9999-99',
                    !empty($revenueActuals) ? min(array_keys($revenueActuals)) : '9999-99'
                );
                if ($earliestActualMonth === null || $firstMonth < $earliestActualMonth) {
                    $earliestActualMonth = $firstMonth;
                }
            }

            $currentJobForecast = JobForecast::where('job_number', $jobNumber)
                ->whereYear('forecast_month', $currentForecastMonth->year)
                ->whereMonth('forecast_month', $currentForecastMonth->month)
                ->latest('forecast_month')
                ->first();
            $jobForecastId = $currentJobForecast?->id;
            if (!$jobForecastId) {
                $jobForecastId = JobForecast::where('job_number', $jobNumber)
                    ->latest('forecast_month')
                    ->value('id');
            }

            // Get monthly cost forecasts for the current forecast month
            $costForecast = [];
            if ($jobForecastId) {
                $costForecast = JobForecastData::where('job_number', $jobNumber)
                    ->where('job_forecast_id', $jobForecastId)
                    ->where('grid_type', 'cost')
                    ->select('month', DB::raw('SUM(forecast_amount) as amount'))
                    ->groupBy('month')
                    ->orderBy('month')
                    ->get()
                    ->pluck('amount', 'month')
                    ->toArray();
            }

            // Get monthly revenue forecasts for the current forecast month
            $revenueForecast = [];
            if ($jobForecastId) {
                $revenueForecast = JobForecastData::where('job_number', $jobNumber)
                    ->where('job_forecast_id', $jobForecastId)
                    ->where('grid_type', 'revenue')
                    ->select('month', DB::raw('SUM(forecast_amount) as amount'))
                    ->groupBy('month')
                    ->orderBy('month')
                    ->get()
                    ->pluck('amount', 'month')
                    ->toArray();
            }

            // Track latest forecast month
            if (!empty($costForecast) || !empty($revenueForecast)) {
                $lastForecast = max(
                    !empty($costForecast) ? max(array_keys($costForecast)) : '0000-00',
                    !empty($revenueForecast) ? max(array_keys($revenueForecast)) : '0000-00'
                );
                if ($latestForecastMonth === null || $lastForecast > $latestForecastMonth) {
                    $latestForecastMonth = $lastForecast;
                }
            }

            // ============ REVENUE FY CALCULATIONS ============
            // Calculate revenue forecast this FY
            $revenueForecastFY = 0;
            foreach ($revenueForecast as $month => $amount) {
                if (
                    $month >= date('Y-m', strtotime($fyStartDate)) &&
                    $month <= date('Y-m', strtotime($fyEndDate))
                ) {
                    $revenueForecastFY += $amount;
                }
            }

            // Revenue Contract FY = actuals this FY + forecast this FY
            $revenueContractFY = $claimedActualsFY + $revenueForecastFY;

            // Remaining revenue value FY = Contract FY - claimed actuals for this FY
            $remainingRevenueValueFY = $revenueContractFY - $claimedActualsFY;

            // Remaining order book = total contract value - total claimed to date
            $remainingOrderBook = $totalContractValue - $claimedToDate;

            // ============ COST FY CALCULATIONS ============
            // Cost actuals this FY
            $costActualsFY = JobCostDetail::where('job_number', $jobNumber)
                ->whereBetween('transaction_date', [$fyStartDate, $fyEndDate])
                ->sum('amount');

            // Calculate cost forecast this FY
            $costForecastFY = 0;
            foreach ($costForecast as $month => $amount) {
                if (
                    $month >= date('Y-m', strtotime($fyStartDate)) &&
                    $month <= date('Y-m', strtotime($fyEndDate))
                ) {
                    $costForecastFY += $amount;
                }
            }

            // Cost Contract FY = actuals this FY + forecast this FY
            $costContractFY = $costActualsFY + $costForecastFY;

            // Remaining cost value FY = Contract FY - cost actuals for this FY
            $remainingCostValueFY = $costContractFY - $costActualsFY;

            // Remaining budget = total budget - cost to date
            $remainingBudget = $budget - $costToDate;

            $combinedData[] = [
                'id' => $location->id,
                'type' => 'location',
                'job_name' => $location->name,
                'job_number' => $jobNumber,
                'project_manager' => $projectManager,
                'over_under_billing' => (float) $over_under_billing,
                // Revenue fields
                'current_estimate_revenue' => (float) $currentEstimateRevenue,
                'current_estimate_cost' => (float) $budget,
                'claimed_to_date' => (float) $claimedToDate,
                'revenue_contract_fy' => (float) $revenueContractFY,
                'total_contract_value' => (float) $totalContractValue,
                'remaining_revenue_value_fy' => (float) $remainingRevenueValueFY,
                'remaining_order_book' => (float) $remainingOrderBook,
                // Cost fields
                'cost_to_date' => (float) $costToDate,
                'cost_contract_fy' => (float) $costContractFY,
                'budget' => (float) $budget,
                'remaining_cost_value_fy' => (float) $remainingCostValueFY,
                'remaining_budget' => (float) $remainingBudget,
                // Monthly data
                'revenue_actuals' => $revenueActuals,
                'revenue_forecast' => $revenueForecast,
                'cost_actuals' => $costActuals,
                'cost_forecast' => $costForecast,
            ];
        }

        // Process forecast projects
        foreach ($forecastProjects as $project) {
            // Budget from cost items
            $budget = $project->costItems->sum('estimate_at_completion');

            // Total contract value from revenue items
            $totalContractValue = $project->revenueItems->sum('contract_sum_to_date');

            // Get monthly cost forecasts
            $costForecast = JobForecastData::where('forecast_project_id', $project->id)
                ->where('grid_type', 'cost')
                ->select('month', DB::raw('SUM(forecast_amount) as amount'))
                ->groupBy('month')
                ->orderBy('month')
                ->get()
                ->pluck('amount', 'month')
                ->toArray();

            // Get monthly revenue forecasts
            $revenueForecast = JobForecastData::where('forecast_project_id', $project->id)
                ->where('grid_type', 'revenue')
                ->select('month', DB::raw('SUM(forecast_amount) as amount'))
                ->groupBy('month')
                ->orderBy('month')
                ->get()
                ->pluck('amount', 'month')
                ->toArray();

            // Track latest forecast month
            if (!empty($costForecast) || !empty($revenueForecast)) {
                $lastForecast = max(
                    !empty($costForecast) ? max(array_keys($costForecast)) : '0000-00',
                    !empty($revenueForecast) ? max(array_keys($revenueForecast)) : '0000-00'
                );
                if ($latestForecastMonth === null || $lastForecast > $latestForecastMonth) {
                    $latestForecastMonth = $lastForecast;
                }
            }

            // ============ REVENUE FY CALCULATIONS ============
            // Calculate revenue forecast this FY (no actuals for forecast projects)
            $revenueForecastFY = 0;
            foreach ($revenueForecast as $month => $amount) {
                if (
                    $month >= date('Y-m', strtotime($fyStartDate)) &&
                    $month <= date('Y-m', strtotime($fyEndDate))
                ) {
                    $revenueForecastFY += $amount;
                }
            }

            // Revenue Contract FY = forecast this FY (no actuals for forecast projects)
            $revenueContractFY = $revenueForecastFY;

            // Remaining revenue value FY = Contract FY (same as contract FY for forecast projects)
            $remainingRevenueValueFY = $revenueContractFY;

            // Remaining order book = total contract value (no claims yet)
            $remainingOrderBook = $totalContractValue;

            // ============ COST FY CALCULATIONS ============
            // Calculate cost forecast this FY (no actuals for forecast projects)
            $costForecastFY = 0;
            foreach ($costForecast as $month => $amount) {
                if (
                    $month >= date('Y-m', strtotime($fyStartDate)) &&
                    $month <= date('Y-m', strtotime($fyEndDate))
                ) {
                    $costForecastFY += $amount;
                }
            }

            // Cost Contract FY = forecast this FY (no actuals for forecast projects)
            $costContractFY = $costForecastFY;

            // Remaining cost value FY = Contract FY (same as contract FY for forecast projects)
            $remainingCostValueFY = $costContractFY;

            // Remaining budget = total budget (no costs yet)
            $remainingBudget = $budget;

            $combinedData[] = [
                'id' => $project->id,
                'type' => 'forecast_project',
                'job_name' => $project->name,
                'job_number' => $project->project_number,
                // Revenue fields
                'claimed_to_date' => 0,
                'current_estimate_revenue' => 0,
                'revenue_contract_fy' => (float) $revenueContractFY,
                'total_contract_value' => (float) $totalContractValue,
                'remaining_revenue_value_fy' => (float) $remainingRevenueValueFY,
                'remaining_order_book' => (float) $remainingOrderBook,
                // Cost fields
                'cost_to_date' => 0,
                'cost_contract_fy' => (float) $costContractFY,
                'budget' => (float) $budget,
                'remaining_cost_value_fy' => (float) $remainingCostValueFY,
                'remaining_budget' => (float) $remainingBudget,
                // Monthly data
                'revenue_actuals' => [],
                'revenue_forecast' => $revenueForecast,
                'cost_actuals' => [],
                'cost_forecast' => $costForecast,
            ];
        }

        // Generate complete month range from earliest actual to latest forecast
        // Ensure we have a start month (default to current month if no data)
        $startMonth = $earliestActualMonth ?? date('Y-m');
        $endMonth = $latestForecastMonth ?? date('Y-m');

        // If we have actuals but no forecasts, extend to at least 12 months from now
        if ($earliestActualMonth && !$latestForecastMonth) {
            $endMonth = date('Y-m', strtotime('+12 months'));
        }

        // Generate all months in range
        $allMonths = $this->generateMonthRange($startMonth, $endMonth);

        // Determine the last actual month globally (for coloring columns)
        $lastActualMonthGlobal = null;
        foreach ($combinedData as $row) {
            if (!empty($row['revenue_actuals'])) {
                $lastActual = max(array_keys($row['revenue_actuals']));
                if ($lastActualMonthGlobal === null || $lastActual > $lastActualMonthGlobal) {
                    $lastActualMonthGlobal = $lastActual;
                }
            }
            if (!empty($row['cost_actuals'])) {
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
            'fyLabel' => "FY{$fyStartYear}-" . substr($fyEndYear, 2, 2),
        ]);
    }
}
