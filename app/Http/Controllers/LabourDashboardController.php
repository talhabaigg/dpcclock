<?php

namespace App\Http\Controllers;

use App\Models\Clock;
use App\Models\Employee;
use App\Models\Location;
use App\Models\PayRun;
use App\Models\PayRunLeaveAccrual;
use App\Models\Worktype;
use App\Services\EmploymentHeroService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class LabourDashboardController extends Controller
{
    // Normal work type external IDs
    const NORMAL_WORK_CODES = ['01-01', '03-01', '05-01', '07-01'];

    // Daily hours threshold before overtime kicks in
    const DAILY_HOURS_THRESHOLD = 8;


    public function index(Request $request)
    {
        $user = $request->user();

        $query = Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])
            ->open()
            ->orderBy('name');

        // Scope locations if user doesn't have view-all permission
        if (!$user->can('labour-dashboard.view-all')) {
            $managedEhLocationIds = $user->managedKiosks()
                ->with('location')
                ->get()
                ->pluck('location.eh_location_id')
                ->filter()
                ->unique();

            $query->whereIn('eh_location_id', $managedEhLocationIds);
        }

        $locations = $query->get(['id', 'name', 'eh_location_id', 'eh_parent_id', 'external_id']);

        return Inertia::render('labour-dashboard/index', [
            'locations' => $locations,
        ]);
    }

    public function getData(Request $request)
    {
        $request->validate([
            'location_ids' => 'required|array|min:1',
            'location_ids.*' => 'integer|exists:locations,id',
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
        ]);

        $locationIds = $request->input('location_ids');
        $dateFrom = Carbon::parse($request->input('date_from'))->startOfDay();
        $dateTo = Carbon::parse($request->input('date_to'))->endOfDay();

        // Get selected locations and their sub-locations
        $selectedLocations = Location::whereIn('id', $locationIds)->get();

        // Build a map: parent location -> all eh_location_ids (self + children)
        $parentLocationMap = [];
        foreach ($selectedLocations as $location) {
            $ehLocationId = $location->eh_location_id;

            // Get sub-location eh_location_ids
            $subLocationEhIds = Location::where('eh_parent_id', $ehLocationId)
                ->pluck('eh_location_id')
                ->toArray();

            $allEhIds = array_merge([$ehLocationId], $subLocationEhIds);

            $parentLocationMap[] = [
                'id' => $location->id,
                'name' => $location->name,
                'external_id' => $location->external_id,
                'eh_location_ids' => $allEhIds,
            ];
        }

        // Collect all eh_location_ids across all selected locations
        $allEhLocationIds = collect($parentLocationMap)->pluck('eh_location_ids')->flatten()->unique()->toArray();

        // Get relevant worktype IDs
        $normalWorkTypeIds = Worktype::whereIn('eh_external_id', self::NORMAL_WORK_CODES)
            ->pluck('eh_worktype_id')
            ->toArray();

        $sickLeaveWorkTypeIds = Worktype::where('name', 'like', '%Personal%Carer%Leave%')
            ->pluck('eh_worktype_id')
            ->toArray();

        $annualLeaveWorkTypeIds = Worktype::where('name', 'like', '%Annual Leave%')
            ->pluck('eh_worktype_id')
            ->toArray();

        $rdoWorkTypeIds = Worktype::where(function ($q) {
            $q->where('name', 'like', '%RDO Taken%')
              ->orWhere('name', 'like', '%Rostered Day Off Taken%');
        })->pluck('eh_worktype_id')->toArray();

        $publicHolidayWorkTypeIds = Worktype::where('name', 'like', '%Public Holiday%')
            ->pluck('eh_worktype_id')
            ->toArray();

        $excludedWorkTypeIds = Worktype::where('name', 'like', '%Workcover%')
            ->pluck('eh_worktype_id')
            ->toArray();

        // Build weather/safety sub-location lookup per parent
        $weatherEhIdsByParent = [];
        $safetyEhIdsByParent = [];
        foreach ($parentLocationMap as $idx => $parentLocation) {
            $weatherEhIdsByParent[$idx] = Location::where('eh_parent_id', $parentLocation['eh_location_ids'][0])
                ->where(function ($q) {
                    $q->where('name', 'like', '%Inclement Weather%')
                      ->orWhere('name', 'like', '%Weather%');
                })->pluck('eh_location_id')->toArray();

            $safetyEhIdsByParent[$idx] = Location::where('eh_parent_id', $parentLocation['eh_location_ids'][0])
                ->where('name', 'like', '%Safety%')
                ->where('name', 'not like', '%Data%')
                ->pluck('eh_location_id')->toArray();
        }

        // Fetch all relevant clocks in one query (processed + approved, excluding Workcover)
        $clocks = Clock::whereIn('eh_location_id', $allEhLocationIds)
            ->where('clock_in', '>=', $dateFrom)
            ->where('clock_in', '<=', $dateTo)
            ->whereIn('status', ['Processed', 'Approved'])
            ->whereNotIn('eh_worktype_id', $excludedWorkTypeIds)
            ->whereNotNull('hours_worked')
            ->where('hours_worked', '>', 0)
            ->select('eh_location_id', 'eh_employee_id', 'eh_worktype_id', 'hours_worked', 'clock_in')
            ->get();

        // Build results per parent location
        $results = [];
        foreach ($parentLocationMap as $idx => $parentLocation) {
            $locationClocks = $clocks->whereIn('eh_location_id', $parentLocation['eh_location_ids']);

            // --- Exclude weather/safety sub-location clocks from normal work ---
            $nonProductiveEhIds = array_merge(
                $weatherEhIdsByParent[$idx] ?? [],
                $safetyEhIdsByParent[$idx] ?? [],
            );

            // --- Normal work clocks (for NT/OT split), excluding weather/safety locations ---
            $normalClocks = $locationClocks->whereIn('eh_worktype_id', $normalWorkTypeIds)
                ->whereNotIn('eh_location_id', $nonProductiveEhIds);

            // Group by employee + date for OT calculation
            $employeeDayGroups = $normalClocks->groupBy(function ($clock) {
                return $clock->eh_employee_id . '|' . Carbon::parse($clock->clock_in)->toDateString();
            });

            $normalTime = 0;
            $overtime = 0;
            foreach ($employeeDayGroups as $group) {
                $dayTotal = $group->sum('hours_worked');
                $nt = min($dayTotal, self::DAILY_HOURS_THRESHOLD);
                $ot = max(0, $dayTotal - self::DAILY_HOURS_THRESHOLD);
                $normalTime += $nt;
                $overtime += $ot;
            }

            // --- Total hours worked (normal work types only) ---
            $totalHoursWorked = $normalClocks->sum('hours_worked');

            // --- Weather hours (by sub-location name) ---
            $weatherHours = $locationClocks->whereIn('eh_location_id', $weatherEhIdsByParent[$idx] ?? [])
                ->sum('hours_worked');

            // --- Safety hours (by sub-location name) ---
            $safetyHours = $locationClocks->whereIn('eh_location_id', $safetyEhIdsByParent[$idx] ?? [])
                ->sum('hours_worked');

            // --- Annual leave hours ---
            $annualLeaveHours = $locationClocks->whereIn('eh_worktype_id', $annualLeaveWorkTypeIds)
                ->sum('hours_worked');

            // --- Sick leave hours ---
            $sickLeaveHours = $locationClocks->whereIn('eh_worktype_id', $sickLeaveWorkTypeIds)
                ->sum('hours_worked');

            // --- RDO hours ---
            $rdoHours = $locationClocks->whereIn('eh_worktype_id', $rdoWorkTypeIds)
                ->sum('hours_worked');

            // --- Public holiday hours ---
            $publicHolidayHours = $locationClocks->whereIn('eh_worktype_id', $publicHolidayWorkTypeIds)
                ->sum('hours_worked');

            // --- Total hours lost ---
            $totalHoursLost = $weatherHours + $safetyHours + $annualLeaveHours + $sickLeaveHours + $rdoHours + $publicHolidayHours;

            // --- Total available hours (all work types) ---
            $totalAvailableHours = $locationClocks->sum('hours_worked');

            // --- Head count (unique employees) ---
            $headCount = $locationClocks->pluck('eh_employee_id')->unique()->count();

            // --- Efficiency % ---
            $efficiency = $totalAvailableHours > 0
                ? round(($totalHoursWorked / $totalAvailableHours) * 100, 1)
                : 0;

            $results[] = [
                'location_id' => $parentLocation['id'],
                'location_name' => $parentLocation['name'],
                'external_id' => $parentLocation['external_id'],
                'normal_time' => round($normalTime, 2),
                'overtime' => round($overtime, 2),
                'total_hours_worked' => round($totalHoursWorked, 2),
                'weather_hours' => round($weatherHours, 2),
                'safety_hours' => round($safetyHours, 2),
                'annual_leave_hours' => round($annualLeaveHours, 2),
                'sick_leave_hours' => round($sickLeaveHours, 2),
                'rdo_hours' => round($rdoHours, 2),
                'public_holiday_hours' => round($publicHolidayHours, 2),
                'total_hours_lost' => round($totalHoursLost, 2),
                'total_available_hours' => round($totalAvailableHours, 2),
                'head_count' => $headCount,
                'efficiency' => $efficiency,
            ];
        }

        return response()->json($results);
    }

    public function getSickLeaveTrend(Request $request)
    {
        $request->validate([
            'location_ids' => 'required|array|min:1',
            'location_ids.*' => 'integer|exists:locations,id',
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
        ]);

        $locationIds = $request->input('location_ids');
        $dateFrom = Carbon::parse($request->input('date_from'))->startOfDay();
        $dateTo = Carbon::parse($request->input('date_to'))->endOfDay();

        $selectedLocations = Location::whereIn('id', $locationIds)->get();

        // Build parent -> eh_location_ids map
        $parentLocationMap = [];
        foreach ($selectedLocations as $location) {
            $subLocationEhIds = Location::where('eh_parent_id', $location->eh_location_id)
                ->pluck('eh_location_id')
                ->toArray();

            $parentLocationMap[] = [
                'id' => $location->id,
                'name' => $location->name,
                'external_id' => $location->external_id ?? $location->name,
                'eh_location_ids' => array_merge([$location->eh_location_id], $subLocationEhIds),
            ];
        }

        $allEhLocationIds = collect($parentLocationMap)->pluck('eh_location_ids')->flatten()->unique()->toArray();

        $sickLeaveWorkTypeIds = Worktype::where('name', 'like', '%Personal%Carer%Leave%')
            ->pluck('eh_worktype_id')
            ->toArray();

        $excludedWorkTypeIds = Worktype::where('name', 'like', '%Workcover%')
            ->pluck('eh_worktype_id')
            ->toArray();

        // Fetch sick leave clocks
        $clocks = Clock::whereIn('eh_location_id', $allEhLocationIds)
            ->where('clock_in', '>=', $dateFrom)
            ->where('clock_in', '<=', $dateTo)
            ->whereIn('status', ['Processed', 'Approved'])
            ->whereIn('eh_worktype_id', $sickLeaveWorkTypeIds)
            ->whereNotIn('eh_worktype_id', $excludedWorkTypeIds)
            ->whereNotNull('hours_worked')
            ->where('hours_worked', '>', 0)
            ->select('eh_location_id', 'eh_employee_id', 'hours_worked', 'clock_in')
            ->get();

        // Build eh_location_id -> parent location index
        $ehToParentIdx = [];
        foreach ($parentLocationMap as $idx => $parent) {
            foreach ($parent['eh_location_ids'] as $ehId) {
                $ehToParentIdx[$ehId] = $idx;
            }
        }

        // Aggregate by week (total) and by week+project
        $byWeek = [];
        $byWeekProject = []; // [weekKey][projectName] => hours
        $projectNames = [];

        foreach ($clocks as $clock) {
            $clockDate = Carbon::parse($clock->clock_in);
            // Week ending Sunday
            $weekEnding = $clockDate->copy()->endOfWeek(Carbon::SUNDAY)->format('Y-m-d');
            $parentIdx = $ehToParentIdx[$clock->eh_location_id] ?? null;
            if ($parentIdx === null) continue;

            $locationName = $parentLocationMap[$parentIdx]['external_id'];
            $projectNames[$locationName] = true;

            // Weekly total
            $byWeek[$weekEnding] = ($byWeek[$weekEnding] ?? 0) + $clock->hours_worked;

            // By week + project
            if (!isset($byWeekProject[$weekEnding][$locationName])) {
                $byWeekProject[$weekEnding][$locationName] = 0;
            }
            $byWeekProject[$weekEnding][$locationName] += $clock->hours_worked;
        }

        // Sort weeks chronologically
        ksort($byWeek);
        ksort($byWeekProject);

        // Build weekly trend with month labels for x-axis
        $lastMonth = null;
        $weeklyTrend = [];
        foreach ($byWeek as $weekEnding => $hours) {
            $date = Carbon::parse($weekEnding);
            $month = $date->format('M Y');
            $weeklyTrend[] = [
                'week' => $date->format('d M'),
                'month' => $month !== $lastMonth ? $month : '',
                'hours' => round($hours, 2),
            ];
            $lastMonth = $month;
        }

        // Build per-project weekly trend with month labels
        $lastMonth = null;
        $projectTrend = [];
        foreach ($byWeekProject as $weekEnding => $projects) {
            $date = Carbon::parse($weekEnding);
            $month = $date->format('M Y');
            $row = [
                'week' => $date->format('d M'),
                'month' => $month !== $lastMonth ? $month : '',
            ];
            foreach ($projects as $name => $hours) {
                $row[$name] = round($hours, 2);
            }
            $projectTrend[] = $row;
            $lastMonth = $month;
        }

        // Aggregate sick leave by employee
        $byEmployee = [];
        foreach ($clocks as $clock) {
            $parentIdx = $ehToParentIdx[$clock->eh_location_id] ?? null;
            if ($parentIdx === null) continue;

            $employeeId = $clock->eh_employee_id;
            if (!isset($byEmployee[$employeeId])) {
                $byEmployee[$employeeId] = 0;
            }
            $byEmployee[$employeeId] += $clock->hours_worked;
        }

        // Resolve employee names
        $employeeIds = array_keys($byEmployee);
        $employees = Employee::withTrashed()->whereIn('eh_employee_id', $employeeIds)
            ->get(['eh_employee_id', 'name', 'preferred_name', 'external_id', 'deleted_at'])
            ->keyBy('eh_employee_id');

        $employeeSummary = [];
        foreach ($byEmployee as $employeeId => $hours) {
            $employee = $employees->get($employeeId);
            $employeeSummary[] = [
                'employee_id' => $employeeId,
                'name' => $employee?->display_name ?? "Unknown ({$employeeId})",
                'external_id' => $employee?->external_id,
                'hours' => round($hours, 2),
                'archived' => $employee?->trashed() ?? false,
            ];
        }

        // Sort by hours descending
        usort($employeeSummary, fn ($a, $b) => $b['hours'] <=> $a['hours']);

        return response()->json([
            'weekly_trend' => $weeklyTrend,
            'project_trend' => $projectTrend,
            'project_names' => array_keys($projectNames),
            'employee_summary' => $employeeSummary,
        ]);
    }

    public function getAnnualLeaveTrend(Request $request)
    {
        $request->validate([
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
        ]);

        $dateFrom = Carbon::parse($request->input('date_from'))->startOfDay();
        $dateTo = Carbon::parse($request->input('date_to'))->endOfDay();

        // Query annual leave accruals from local pay_run_leave_accruals table
        $rows = PayRunLeaveAccrual::join('pay_runs', 'pay_runs.id', '=', 'pay_run_leave_accruals.pay_run_id')
            ->where('pay_run_leave_accruals.leave_category_name', 'Annual Leave')
            ->whereBetween('pay_runs.pay_period_ending', [$dateFrom, $dateTo])
            ->selectRaw("
                DATE_FORMAT(pay_runs.pay_period_ending, '%Y-%m') as month_key,
                pay_run_leave_accruals.accrual_type,
                SUM(pay_run_leave_accruals.amount) as total_amount
            ")
            ->groupBy('month_key', 'accrual_type')
            ->orderBy('month_key')
            ->get();

        // Categorize: positive accrual types vs negative (taken/used)
        $accrualTypes = ['AutomaticallyAccrued', 'ManuallyApplied', 'LeaveAdjustment'];

        $byMonth = [];
        foreach ($rows as $row) {
            $month = $row->month_key;
            if (!isset($byMonth[$month])) {
                $byMonth[$month] = ['accrued' => 0, 'taken' => 0];
            }

            $amount = (float) $row->total_amount;
            if (in_array($row->accrual_type, $accrualTypes)) {
                $byMonth[$month]['accrued'] += $amount;
            } else {
                // LeaveRequest, ManuallyOverridden, LeaveTermination — these are negative (taken)
                $byMonth[$month]['taken'] += abs($amount);
            }
        }

        ksort($byMonth);

        $cumulativeAccrued = 0;
        $cumulativeTaken = 0;
        $trend = [];

        foreach ($byMonth as $monthKey => $data) {
            $cumulativeAccrued += $data['accrued'];
            $cumulativeTaken += $data['taken'];

            $trend[] = [
                'month' => Carbon::parse($monthKey . '-01')->format('M Y'),
                'accrued' => round($data['accrued'], 2),
                'taken' => round($data['taken'], 2),
                'cumulative_accrued' => round($cumulativeAccrued, 2),
                'cumulative_taken' => round($cumulativeTaken, 2),
                'net_balance' => round($cumulativeAccrued - $cumulativeTaken, 2),
            ];
        }

        return response()->json($trend);
    }

    public function getLeaveBalances(Request $request, EmploymentHeroService $ehService)
    {
        $request->validate([
            'location_ids' => 'required|array|min:1',
            'location_ids.*' => 'integer|exists:locations,id',
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
        ]);

        $asAtDate = $request->input('as_at_date', now()->format('Y-m-d'));
        $dateFrom = Carbon::parse($request->input('date_from'))->startOfDay();
        $dateTo = Carbon::parse($request->input('date_to'))->endOfDay();

        $cacheKey = "leave_balances_{$asAtDate}";
        $balances = Cache::remember($cacheKey, now()->addWeek(), function () use ($ehService, $asAtDate) {
            return $ehService->getLeaveBalances($asAtDate);
        });

        // Get all eh_location_ids for selected locations (including sub-locations)
        $selectedLocations = Location::whereIn('id', $request->input('location_ids'))->get();
        $allEhLocationIds = [];
        foreach ($selectedLocations as $location) {
            $allEhLocationIds[] = $location->eh_location_id;
            $subIds = Location::where('eh_parent_id', $location->eh_location_id)
                ->pluck('eh_location_id')->toArray();
            $allEhLocationIds = array_merge($allEhLocationIds, $subIds);
        }

        // Get unique employee IDs who actually worked in the period
        $activeEmployeeIds = Clock::whereIn('eh_location_id', array_unique($allEhLocationIds))
            ->where('clock_in', '>=', $dateFrom)
            ->where('clock_in', '<=', $dateTo)
            ->whereIn('status', ['Processed', 'Approved'])
            ->distinct()
            ->pluck('eh_employee_id')
            ->map(fn ($id) => (int) $id)
            ->toArray();

        $employees = Employee::withTrashed()
            ->get(['eh_employee_id', 'name', 'preferred_name', 'external_id', 'start_date', 'deleted_at'])
            ->keyBy('eh_employee_id');

        $annualLeave = collect($balances)
            ->where('leaveCategoryName', 'Annual Leave')
            ->filter(function ($row) use ($activeEmployeeIds) {
                return in_array((int) $row['employeeId'], $activeEmployeeIds);
            })
            ->map(function ($row) use ($employees, $asAtDate) {
                $employee = $employees->get($row['employeeId']);
                $tenure = null;
                if ($employee?->start_date) {
                    $tenure = round(Carbon::parse($employee->start_date)->diffInMonths(Carbon::parse($asAtDate)) / 12, 1);
                }

                return [
                    'employee_id' => $row['employeeId'],
                    'external_id' => $row['externalId'] ?? $employee?->external_id,
                    'name' => $employee?->display_name ?? trim($row['firstName'].' '.$row['surname']),
                    'balance_hours' => round((float) ($row['accruedAmountInHours'] ?? 0), 2),
                    'balance_days' => round((float) ($row['accruedAmountInHours'] ?? 0) / 8, 2),
                    'liability' => round((float) ($row['leavePlusLoading'] ?? $row['leaveValue'] ?? 0), 2),
                    'tenure_years' => $tenure,
                    'archived' => $employee?->trashed() ?? false,
                    'location' => $row['location'] ?? null,
                ];
            })
            ->filter(fn ($row) => $row['balance_hours'] != 0 || $row['liability'] != 0)
            ->sortByDesc('balance_hours')
            ->values();

        return response()->json($annualLeave);
    }

    public function getWorkforceStats(Request $request)
    {
        $request->validate([
            'location_ids' => 'required|array|min:1',
            'location_ids.*' => 'integer|exists:locations,id',
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
        ]);

        $locationIds = $request->input('location_ids');
        $dateFrom = Carbon::parse($request->input('date_from'))->startOfDay();
        $dateTo = Carbon::parse($request->input('date_to'))->endOfDay();

        // Get all eh_location_ids for selected locations (including sub-locations)
        $selectedLocations = Location::whereIn('id', $locationIds)->get();
        $allEhLocationIds = [];
        foreach ($selectedLocations as $location) {
            $allEhLocationIds[] = $location->eh_location_id;
            $subIds = Location::where('eh_parent_id', $location->eh_location_id)
                ->pluck('eh_location_id')->toArray();
            $allEhLocationIds = array_merge($allEhLocationIds, $subIds);
        }
        $allEhLocationIds = array_unique($allEhLocationIds);

        // Get unique employee IDs from clocks in the date range
        $employeeIds = Clock::whereIn('eh_location_id', $allEhLocationIds)
            ->where('clock_in', '>=', $dateFrom)
            ->where('clock_in', '<=', $dateTo)
            ->whereIn('status', ['Processed', 'Approved'])
            ->distinct()
            ->pluck('eh_employee_id')
            ->toArray();

        $today = Carbon::today();
        $employees = Employee::withTrashed()
            ->whereIn('eh_employee_id', $employeeIds)
            ->whereNull('deleted_at')
            ->get(['eh_employee_id', 'start_date', 'date_of_birth']);

        $totalWorkers = $employees->count();
        if ($totalWorkers === 0) {
            return response()->json(null);
        }

        $ages = [];
        $tenures = [];

        foreach ($employees as $emp) {
            if ($emp->date_of_birth) {
                $ages[] = Carbon::parse($emp->date_of_birth)->diffInYears($today);
            }
            if ($emp->start_date) {
                $tenures[] = Carbon::parse($emp->start_date)->floatDiffInYears($today);
            }
        }

        $avgAge = count($ages) > 0 ? round(array_sum($ages) / count($ages), 2) : null;
        $avgTenure = count($tenures) > 0 ? round(array_sum($tenures) / count($tenures), 2) : null;

        $over50 = count(array_filter($ages, fn ($a) => $a >= 50));
        $under30 = count(array_filter($ages, fn ($a) => $a < 30));

        $over2 = count(array_filter($tenures, fn ($t) => $t >= 2));
        $over5 = count(array_filter($tenures, fn ($t) => $t >= 5));
        $over10 = count(array_filter($tenures, fn ($t) => $t >= 10));
        $over20 = count(array_filter($tenures, fn ($t) => $t >= 20));

        return response()->json([
            'total_workers' => $totalWorkers,
            'average_age' => $avgAge,
            'workers_over_50_pct' => $totalWorkers > 0 ? round(($over50 / $totalWorkers) * 100, 2) : 0,
            'workers_under_30_pct' => $totalWorkers > 0 ? round(($under30 / $totalWorkers) * 100, 2) : 0,
            'average_tenure' => $avgTenure,
            'workers_over_2_years' => $over2,
            'workers_over_5_years' => $over5,
            'workers_over_10_years' => $over10,
            'workers_over_20_years' => $over20,
        ]);
    }

    public function syncLeaveAccruals(Request $request, EmploymentHeroService $ehService)
    {
        $request->validate([
            'from' => 'nullable|date',
        ]);

        $from = $request->input('from', now()->subMonths(6)->format('Y-m-d'));
        $to = now()->format('Y-m-d');

        try {
            $payRuns = $ehService->getPayRuns($from, $to);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to fetch pay runs: '.$e->getMessage()], 500);
        }

        $synced = 0;
        $skipped = 0;

        foreach ($payRuns as $payRunData) {
            $ehPayRunId = $payRunData['id'] ?? null;
            if (!$ehPayRunId) continue;

            $payRun = PayRun::updateOrCreate(
                ['eh_pay_run_id' => $ehPayRunId],
                [
                    'pay_period_starting' => $payRunData['payPeriodStarting'] ?? null,
                    'pay_period_ending' => $payRunData['payPeriodEnding'] ?? null,
                    'date_paid' => $payRunData['datePaid'] ?? null,
                    'status' => $payRunData['status'] ?? null,
                ],
            );

            if ($payRun->leave_accruals_synced) {
                $skipped++;
                continue;
            }

            try {
                $response = $ehService->getLeaveAccruals($ehPayRunId, true);
            } catch (\Throwable) {
                continue;
            }

            $leaveData = $response['leave'] ?? [];
            $payRun->leaveAccruals()->delete();

            $records = [];
            $now = now();
            foreach ($leaveData as $employeeId => $accruals) {
                foreach ($accruals as $accrual) {
                    $records[] = [
                        'pay_run_id' => $payRun->id,
                        'eh_employee_id' => $employeeId,
                        'leave_category_id' => $accrual['leaveCategoryId'] ?? null,
                        'leave_category_name' => $accrual['leaveCategoryName'] ?? null,
                        'accrual_type' => $accrual['accrualType'] ?? null,
                        'amount' => $accrual['amount'] ?? 0,
                        'notes' => $accrual['notes'] ?? null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }

            foreach (array_chunk($records, 500) as $chunk) {
                PayRunLeaveAccrual::insert($chunk);
            }

            $payRun->update(['leave_accruals_synced' => true]);
            $synced++;
        }

        return response()->json([
            'message' => "Synced {$synced} pay runs, skipped {$skipped} already synced.",
            'synced' => $synced,
            'skipped' => $skipped,
            'total' => count($payRuns),
        ]);
    }

    public function syncStatus()
    {
        $lastPayRun = PayRun::orderByDesc('pay_period_ending')->first();
        $totalPayRuns = PayRun::count();
        $totalAccruals = PayRunLeaveAccrual::count();

        return response()->json([
            'last_synced' => $lastPayRun?->pay_period_ending?->format('d M Y'),
            'total_pay_runs' => $totalPayRuns,
            'total_accruals' => $totalAccruals,
        ]);
    }
}
