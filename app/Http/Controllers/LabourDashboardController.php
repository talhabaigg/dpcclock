<?php

namespace App\Http\Controllers;

use App\Models\Clock;
use App\Models\DailyPrestart;
use App\Models\DailyPrestartSignature;
use App\Models\Employee;
use App\Models\Location;
use App\Models\PayRun;
use App\Models\PayRunLeaveAccrual;
use App\Models\PrestartAbsentee;
use App\Models\Worktype;
use App\Services\EmploymentHeroService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class LabourDashboardController extends Controller
{
    // Normal work type external IDs
    const NORMAL_WORK_CODES = ['01-01', '03-01', '05-01', '07-01'];

    // Daily hours threshold before overtime kicks in
    const DAILY_HOURS_THRESHOLD = 8;

    // Job external_id prefix whose weekends are treated as ordinary time
    // (quick fix — replace with a per-location flag when weekend rules generalise).
    const WEEKEND_ORDINARY_EXTERNAL_ID_PREFIX = 'QTMP';

    /**
     * Whether the selection covers every open project — i.e. no filtering intent,
     * so widgets should keep their company-wide (unfiltered) behaviour.
     */
    private function allOpenProjectsSelected(array $locationIds): bool
    {
        return Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])
            ->open()
            ->pluck('id')
            ->diff($locationIds)
            ->isEmpty();
    }

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

            $isWeekendOrdinary = str_starts_with(
                (string) ($parentLocation['external_id'] ?? ''),
                self::WEEKEND_ORDINARY_EXTERNAL_ID_PREFIX,
            );

            $normalTime = 0;
            $overtime = 0;
            foreach ($employeeDayGroups as $key => $group) {
                $dayTotal = $group->sum('hours_worked');
                [, $dateStr] = explode('|', $key, 2);
                $isWeekend = Carbon::parse($dateStr)->isWeekend();

                if ($isWeekend && !$isWeekendOrdinary) {
                    $overtime += $dayTotal;
                } else {
                    $normalTime += min($dayTotal, self::DAILY_HOURS_THRESHOLD);
                    $overtime += max(0, $dayTotal - self::DAILY_HOURS_THRESHOLD);
                }
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

            // --- Non-standard hours (everything in Available not captured by Worked or Lost) ---
            $nonStandardHours = $totalAvailableHours - $totalHoursWorked - $totalHoursLost;

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
                'non_standard_hours' => round($nonStandardHours, 2),
                'total_available_hours' => round($totalAvailableHours, 2),
                'head_count' => $headCount,
                'efficiency' => $efficiency,
            ];
        }

        // --- Aggregate "Non-Standard" breakdown across selected projects ---
        // These are clocks NOT in Worked (normal-work types outside weather/safety) and NOT in any Lost bucket.
        $bucketedWorkTypeIds = array_merge(
            $normalWorkTypeIds,
            $annualLeaveWorkTypeIds,
            $sickLeaveWorkTypeIds,
            $rdoWorkTypeIds,
            $publicHolidayWorkTypeIds,
        );
        $allWeatherSafetyEhIds = collect($weatherEhIdsByParent)
            ->merge($safetyEhIdsByParent)
            ->flatten()
            ->unique()
            ->toArray();

        $nonStandardClocks = $clocks
            ->whereNotIn('eh_worktype_id', $bucketedWorkTypeIds)
            ->whereNotIn('eh_location_id', $allWeatherSafetyEhIds);

        $nonStandardWorktypeIds = $nonStandardClocks->pluck('eh_worktype_id')->unique()->toArray();
        $worktypeLookup = Worktype::whereIn('eh_worktype_id', $nonStandardWorktypeIds)
            ->get(['eh_worktype_id', 'name', 'mapping_type'])
            ->keyBy('eh_worktype_id');

        $nonStandardBreakdown = $nonStandardClocks
            ->groupBy('eh_worktype_id')
            ->map(function ($group, $ehWorktypeId) use ($worktypeLookup) {
                $worktype = $worktypeLookup->get($ehWorktypeId);
                return [
                    'eh_worktype_id' => $ehWorktypeId,
                    'name' => $worktype?->name ?: '(no work type set)',
                    'mapping_type' => $worktype?->mapping_type,
                    'hours' => round($group->sum('hours_worked'), 2),
                ];
            })
            ->sortByDesc('hours')
            ->values()
            ->all();

        return response()->json([
            'rows' => $results,
            'non_standard_breakdown' => $nonStandardBreakdown,
        ]);
    }

    /**
     * Drill-through: list the underlying timesheets (clocks) for a given category in the Hours Matrix.
     */
    public function timesheets(Request $request)
    {
        $request->validate([
            'location_ids' => 'required|string',
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
            'category' => 'required|in:nt,ot,worked,weather,safety,al,sick,rdo,ph,lost,non_standard,available,industrial_action',
            'worktypes' => 'nullable|array',
            'worktypes.*' => 'string|max:255',
            'search' => 'nullable|string|max:255',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|in:10,25,50,100',
            'sort_key' => 'nullable|in:date,employee_name,hours,worktype_name,location_name',
            'sort_dir' => 'nullable|in:asc,desc',
        ]);

        $user = $request->user();
        $rawIds = array_filter(array_map('intval', explode(',', $request->input('location_ids'))));
        $dateFrom = Carbon::parse($request->input('date_from'))->startOfDay();
        $dateTo = Carbon::parse($request->input('date_to'))->endOfDay();
        $category = $request->input('category');
        $search = trim((string) $request->input('search', ''));
        $perPage = (int) ($request->input('per_page') ?? 25);
        $page = max(1, (int) ($request->input('page') ?? 1));
        $sortKey = (string) ($request->input('sort_key') ?? 'date');
        $sortDir = (string) ($request->input('sort_dir') ?? 'asc');

        // Scope to user's permitted locations if they lack view-all
        $locationQuery = Location::whereIn('id', $rawIds);
        if (!$user->can('labour-dashboard.view-all')) {
            $managedEhIds = $user->managedKiosks()->with('location')->get()
                ->pluck('location.eh_location_id')->filter()->unique();
            $locationQuery->whereIn('eh_location_id', $managedEhIds);
        }
        $selectedLocations = $locationQuery->get();

        $parentLocationMap = [];
        foreach ($selectedLocations as $location) {
            $subEhIds = Location::where('eh_parent_id', $location->eh_location_id)
                ->pluck('eh_location_id')->toArray();
            $parentLocationMap[] = [
                'id' => $location->id,
                'name' => $location->name,
                'external_id' => $location->external_id,
                'eh_location_ids' => array_merge([$location->eh_location_id], $subEhIds),
            ];
        }
        $allEhLocationIds = collect($parentLocationMap)->pluck('eh_location_ids')->flatten()->unique()->toArray();

        // eh_location_ids belonging to jobs that treat weekends as ordinary time.
        $weekendOrdinaryEhIds = [];
        foreach ($parentLocationMap as $p) {
            if (str_starts_with((string) ($p['external_id'] ?? ''), self::WEEKEND_ORDINARY_EXTERNAL_ID_PREFIX)) {
                foreach ($p['eh_location_ids'] as $ehId) {
                    $weekendOrdinaryEhIds[$ehId] = true;
                }
            }
        }

        // Worktype buckets — same definitions as getData()
        $normalIds = Worktype::whereIn('eh_external_id', self::NORMAL_WORK_CODES)->pluck('eh_worktype_id')->toArray();
        $sickIds = Worktype::where('name', 'like', '%Personal%Carer%Leave%')->pluck('eh_worktype_id')->toArray();
        $alIds = Worktype::where('name', 'like', '%Annual Leave%')->pluck('eh_worktype_id')->toArray();
        $rdoIds = Worktype::where(function ($q) {
            $q->where('name', 'like', '%RDO Taken%')->orWhere('name', 'like', '%Rostered Day Off Taken%');
        })->pluck('eh_worktype_id')->toArray();
        $phIds = Worktype::where('name', 'like', '%Public Holiday%')->pluck('eh_worktype_id')->toArray();
        $wcIds = Worktype::where('name', 'like', '%Workcover%')->pluck('eh_worktype_id')->toArray();

        // Weather/Safety sub-locations
        $weatherEhIds = [];
        $safetyEhIds = [];
        foreach ($parentLocationMap as $p) {
            $weatherEhIds = array_merge($weatherEhIds, Location::where('eh_parent_id', $p['eh_location_ids'][0])
                ->where(function ($q) {
                    $q->where('name', 'like', '%Inclement Weather%')->orWhere('name', 'like', '%Weather%');
                })->pluck('eh_location_id')->toArray());
            $safetyEhIds = array_merge($safetyEhIds, Location::where('eh_parent_id', $p['eh_location_ids'][0])
                ->where('name', 'like', '%Safety%')->where('name', 'not like', '%Data%')
                ->pluck('eh_location_id')->toArray());
        }
        $weatherSafetyEhIds = array_merge($weatherEhIds, $safetyEhIds);
        $bucketedIds = array_merge($normalIds, $alIds, $sickIds, $rdoIds, $phIds);

        $query = Clock::whereIn('eh_location_id', $allEhLocationIds)
            ->where('clock_in', '>=', $dateFrom)
            ->where('clock_in', '<=', $dateTo)
            ->whereIn('status', ['Processed', 'Approved'])
            ->whereNotIn('eh_worktype_id', $wcIds)
            ->whereNotNull('hours_worked')
            ->where('hours_worked', '>', 0);

        // If worktypes[] is provided, it takes precedence over the category's worktype/location filter.
        // This lets callers drill through to "all clocks for these specific worktypes" without
        // the category's extra constraints (normal-work-codes intersect, weather/safety exclusion, NT/OT split).
        $worktypeFilter = $request->input('worktypes');
        $useWorktypeFilter = is_array($worktypeFilter) && !empty($worktypeFilter);

        if (!$useWorktypeFilter) {
            match ($category) {
                'available' => null,
                'worked', 'nt', 'ot' => $query->whereIn('eh_worktype_id', $normalIds)
                    ->whereNotIn('eh_location_id', $weatherSafetyEhIds),
                'weather' => $query->whereIn('eh_location_id', $weatherEhIds),
                'safety' => $query->whereIn('eh_location_id', $safetyEhIds),
                'al' => $query->whereIn('eh_worktype_id', $alIds),
                'sick' => $query->whereIn('eh_worktype_id', $sickIds),
                'rdo' => $query->whereIn('eh_worktype_id', $rdoIds),
                'ph' => $query->whereIn('eh_worktype_id', $phIds),
                'lost' => $query->where(function ($q) use ($weatherSafetyEhIds, $alIds, $sickIds, $rdoIds, $phIds) {
                    $q->whereIn('eh_location_id', $weatherSafetyEhIds)
                      ->orWhereIn('eh_worktype_id', array_merge($alIds, $sickIds, $rdoIds, $phIds));
                }),
                'non_standard' => $query->whereNotIn('eh_worktype_id', $bucketedIds)
                    ->whereNotIn('eh_location_id', $weatherSafetyEhIds),
                'industrial_action' => $query->where('eh_worktype_id', 2585103),
            };
        } else {
            $wtIds = Worktype::whereIn('name', $worktypeFilter)->pluck('eh_worktype_id')->toArray();
            $query->whereIn('eh_worktype_id', $wtIds ?: [0]);
        }

        $clocks = $query->orderBy('clock_in')->limit(10000)->get();

        // For OT category, keep days where either:
        //   (a) the employee's daily normal-work total exceeded the 8h threshold, or
        //   (b) the day is a weekend on a job that does NOT treat weekends as ordinary time.
        // Skip when a worktype filter is in play — the caller wants raw hours, not the OT split.
        if ($category === 'ot' && !$useWorktypeFilter) {
            $grouped = $clocks->groupBy(fn ($c) => $c->eh_employee_id . '|' . Carbon::parse($c->clock_in)->toDateString());
            $clocks = $grouped->filter(function ($g) use ($weekendOrdinaryEhIds) {
                $first = $g->first();
                $isWeekend = Carbon::parse($first->clock_in)->isWeekend();
                $weekendCountsAsOt = $isWeekend && !isset($weekendOrdinaryEhIds[$first->eh_location_id]);
                return $weekendCountsAsOt || $g->sum('hours_worked') > self::DAILY_HOURS_THRESHOLD;
            })->flatten(1)->values();
        }

        // Hydrate names. Include soft-deleted employees so archived staff still resolve to a name.
        $empLookup = Employee::withTrashed()
            ->whereIn('eh_employee_id', $clocks->pluck('eh_employee_id')->unique())
            ->get(['eh_employee_id', 'name', 'preferred_name', 'deleted_at'])->keyBy('eh_employee_id');
        $locLookup = Location::whereIn('eh_location_id', $clocks->pluck('eh_location_id')->unique())
            ->get(['eh_location_id', 'name'])->keyBy('eh_location_id');
        $wtLookup = Worktype::whereIn('eh_worktype_id', $clocks->pluck('eh_worktype_id')->unique())
            ->get(['eh_worktype_id', 'name', 'eh_external_id', 'mapping_type'])->keyBy('eh_worktype_id');

        // Daily totals for NT/OT split when relevant. Skipped when worktypes[] is the driver —
        // the caller wants raw clock hours, not a daily-threshold split.
        $dailyTotals = null;
        if (!$useWorktypeFilter && in_array($category, ['nt', 'ot', 'worked'], true)) {
            $dailyTotals = $clocks
                ->groupBy(fn ($c) => $c->eh_employee_id . '|' . Carbon::parse($c->clock_in)->toDateString())
                ->map(fn ($g) => $g->sum('hours_worked'));
        }

        $rows = $clocks->map(function ($c) use ($empLookup, $locLookup, $wtLookup, $dailyTotals, $category, $weekendOrdinaryEhIds) {
            $emp = $empLookup->get($c->eh_employee_id);
            $loc = $locLookup->get($c->eh_location_id);
            $wt = $wtLookup->get($c->eh_worktype_id);
            $dt = Carbon::parse($c->clock_in);

            $resolvedName = $emp?->display_name ?: $emp?->name;
            $archivedSuffix = $emp && $emp->deleted_at ? ' (archived)' : '';
            $row = [
                'id' => $c->id,
                'employee_name' => $resolvedName ? $resolvedName . $archivedSuffix : ('(unknown ' . $c->eh_employee_id . ')'),
                'eh_employee_id' => $c->eh_employee_id,
                'date' => $dt->format('Y-m-d'),
                'day' => $dt->format('D'),
                'clock_in' => $dt->format('Y-m-d H:i'),
                'clock_out' => $c->clock_out ? Carbon::parse($c->clock_out)->format('Y-m-d H:i') : null,
                'hours' => round((float) $c->hours_worked, 2),
                'worktype_name' => $wt?->name ?: '(no work type)',
                'worktype_external_id' => $wt?->eh_external_id,
                'worktype_mapping_type' => $wt?->mapping_type,
                'location_name' => $loc?->name ?: ('(eh_loc ' . $c->eh_location_id . ')'),
                'eh_location_id' => $c->eh_location_id,
                'status' => $c->status,
            ];

            if ($dailyTotals !== null) {
                $key = $c->eh_employee_id . '|' . $dt->toDateString();
                $dayTotal = (float) ($dailyTotals[$key] ?? 0);
                $weekendCountsAsOt = $dt->isWeekend() && !isset($weekendOrdinaryEhIds[$c->eh_location_id]);
                if ($weekendCountsAsOt) {
                    $row['nt_hours'] = 0.0;
                    $row['ot_hours'] = round($row['hours'], 2);
                } elseif ($dayTotal > 0) {
                    $ntPortion = min($dayTotal, self::DAILY_HOURS_THRESHOLD);
                    $otPortion = max(0, $dayTotal - self::DAILY_HOURS_THRESHOLD);
                    $row['nt_hours'] = round($row['hours'] * ($ntPortion / $dayTotal), 2);
                    $row['ot_hours'] = round($row['hours'] * ($otPortion / $dayTotal), 2);
                } else {
                    $row['nt_hours'] = 0.0;
                    $row['ot_hours'] = 0.0;
                }
            }

            return $row;
        })->values();

        // Search filter across the full computed set
        if ($search !== '') {
            $needle = mb_strtolower($search);
            $rows = $rows->filter(function ($r) use ($needle) {
                return str_contains(mb_strtolower($r['employee_name']), $needle)
                    || str_contains(mb_strtolower($r['worktype_name']), $needle)
                    || str_contains(mb_strtolower($r['location_name']), $needle)
                    || str_contains($r['date'], $needle);
            })->values();
        }

        // Sort across the full filtered set
        $rows = $rows->sortBy(
            fn ($r) => $r[$sortKey] ?? null,
            SORT_REGULAR,
            $sortDir === 'desc',
        )->values();

        // Totals computed across the search-filtered, pre-paginated set
        $totals = [
            'hours' => round((float) $rows->sum('hours'), 2),
            'nt' => round((float) $rows->sum(fn ($r) => $r['nt_hours'] ?? 0), 2),
            'ot' => round((float) $rows->sum(fn ($r) => $r['ot_hours'] ?? 0), 2),
            'employees' => $rows->pluck('eh_employee_id')->unique()->count(),
        ];

        $total = $rows->count();
        $pageRows = $rows->slice(($page - 1) * $perPage, $perPage)->values();

        $paginator = new LengthAwarePaginator(
            $pageRows,
            $total,
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()],
        );

        // Available projects (locations) for the Filters sheet
        $availableProjectsQuery = Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])
            ->open()
            ->orderBy('name');
        if (!$user->can('labour-dashboard.view-all')) {
            $managedEhIds = $user->managedKiosks()->with('location')->get()
                ->pluck('location.eh_location_id')->filter()->unique();
            $availableProjectsQuery->whereIn('eh_location_id', $managedEhIds);
        }
        $availableProjects = $availableProjectsQuery->get(['id', 'name'])
            ->map(fn ($l) => ['id' => $l->id, 'name' => $l->name])
            ->values();

        return Inertia::render('labour-dashboard/timesheets', [
            'rows' => $paginator,
            'totals' => $totals,
            'category' => $category,
            'date_from' => $dateFrom->format('Y-m-d'),
            'date_to' => $dateTo->format('Y-m-d'),
            'project_names' => collect($parentLocationMap)->pluck('name')->all(),
            'project_ids' => array_values($selectedLocations->pluck('id')->all()),
            'available_projects' => $availableProjects,
            'truncated' => $clocks->count() >= 10000,
            'worktypes' => $useWorktypeFilter ? array_values($worktypeFilter) : [],
            'filters' => [
                'search' => $search !== '' ? $search : null,
                'per_page' => $perPage,
                'sort_key' => $sortKey,
                'sort_dir' => $sortDir,
            ],
        ]);
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

        // Fetch sick leave clocks (location-scoped for trends)
        $clocks = Clock::whereIn('eh_location_id', $allEhLocationIds)
            ->where('clock_in', '>=', $dateFrom)
            ->where('clock_in', '<=', $dateTo)
            ->where('status', 'Processed')
            ->whereIn('eh_worktype_id', $sickLeaveWorkTypeIds)
            ->whereNotIn('eh_worktype_id', $excludedWorkTypeIds)
            ->whereNotNull('hours_worked')
            ->where('hours_worked', '>', 0)
            ->select('eh_location_id', 'eh_employee_id', 'hours_worked', 'clock_in')
            ->get();

        // Fetch ALL sick leave clocks across all locations for employee summary
        $allSickLeaveClocks = Clock::where('clock_in', '>=', $dateFrom)
            ->where('clock_in', '<=', $dateTo)
            ->where('status', 'Processed')
            ->whereIn('eh_worktype_id', $sickLeaveWorkTypeIds)
            ->whereNotIn('eh_worktype_id', $excludedWorkTypeIds)
            ->whereNotNull('hours_worked')
            ->where('hours_worked', '>', 0)
            ->select('eh_employee_id', 'hours_worked')
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

        // Aggregate sick leave by employee, split into selected projects vs everywhere else.
        // Only employees with timesheets at the selected locations in the period are listed;
        // for those, sick leave logged to other projects still shows as "other" so cross-project
        // hours aren't hidden by the filter.
        $selectedByEmployee = [];
        foreach ($clocks as $clock) {
            $selectedByEmployee[$clock->eh_employee_id] = ($selectedByEmployee[$clock->eh_employee_id] ?? 0) + $clock->hours_worked;
        }

        $totalByEmployee = [];
        foreach ($allSickLeaveClocks as $clock) {
            $totalByEmployee[$clock->eh_employee_id] = ($totalByEmployee[$clock->eh_employee_id] ?? 0) + $clock->hours_worked;
        }

        // When every open project is selected there's no filtering intent — keep the full
        // company-wide list. Only a narrower selection restricts names to employees with
        // timesheets at those locations.
        if (!$this->allOpenProjectsSelected($locationIds)) {
            $employeesAtSelected = Clock::whereIn('eh_location_id', $allEhLocationIds)
                ->where('clock_in', '>=', $dateFrom)
                ->where('clock_in', '<=', $dateTo)
                ->whereIn('status', ['Processed', 'Approved'])
                ->distinct()
                ->pluck('eh_employee_id')
                ->flip();

            $totalByEmployee = array_filter(
                $totalByEmployee,
                fn ($employeeId) => isset($employeesAtSelected[$employeeId]),
                ARRAY_FILTER_USE_KEY,
            );
        }

        // Resolve employee names
        $employeeIds = array_keys($totalByEmployee);
        $employees = Employee::withTrashed()->whereIn('eh_employee_id', $employeeIds)
            ->get(['eh_employee_id', 'name', 'preferred_name', 'external_id', 'deleted_at'])
            ->keyBy('eh_employee_id');

        $employeeSummary = [];
        foreach ($totalByEmployee as $employeeId => $totalHours) {
            $employee = $employees->get($employeeId);
            $selectedHours = $selectedByEmployee[$employeeId] ?? 0;
            $employeeSummary[] = [
                'employee_id' => $employeeId,
                'name' => $employee?->display_name ?? "Unknown ({$employeeId})",
                'external_id' => $employee?->external_id,
                'hours' => round($selectedHours, 2),
                'other_hours' => round(max(0, $totalHours - $selectedHours), 2),
                'archived' => $employee?->trashed() ?? false,
            ];
        }

        // Rank by hours at the selected projects, then by hours elsewhere
        usort($employeeSummary, fn ($a, $b) => [$b['hours'], $b['other_hours']] <=> [$a['hours'], $a['other_hours']]);

        return response()->json([
            'weekly_trend' => $weeklyTrend,
            'project_trend' => $projectTrend,
            'project_names' => array_keys($projectNames),
            'employee_summary' => $employeeSummary,
        ]);
    }

    public function getAnnualLeaveTrend(Request $request, EmploymentHeroService $ehService)
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

        // Running balance: query Employment Hero's leave balances as at each month end.
        // Resolve each month-end date, then fetch uncached dates in parallel via Http::pool.
        $monthEndByKey = [];
        foreach (array_keys($byMonth) as $monthKey) {
            $monthEnd = Carbon::parse($monthKey . '-01')->endOfMonth();
            if ($monthEnd->gt($dateTo)) {
                $monthEnd = $dateTo->copy();
            }
            $monthEndByKey[$monthKey] = $monthEnd->format('Y-m-d');
        }

        $balancesByDate = [];
        $datesToFetch = [];
        foreach (array_unique($monthEndByKey) as $asAtDate) {
            $cached = Cache::get("leave_balances_{$asAtDate}");
            if ($cached !== null) {
                $balancesByDate[$asAtDate] = $cached;
            } else {
                $datesToFetch[] = $asAtDate;
            }
        }

        if (!empty($datesToFetch)) {
            $fetched = $ehService->getLeaveBalancesBatch($datesToFetch);
            foreach ($fetched as $date => $balances) {
                Cache::put("leave_balances_{$date}", $balances, now()->addWeek());
                $balancesByDate[$date] = $balances;
            }
        }

        $cumulativeAccrued = 0;
        $cumulativeTaken = 0;
        $trend = [];

        foreach ($byMonth as $monthKey => $data) {
            $cumulativeAccrued += $data['accrued'];
            $cumulativeTaken += $data['taken'];

            $asAtDate = $monthEndByKey[$monthKey];
            $netBalance = (float) collect($balancesByDate[$asAtDate] ?? [])
                ->where('leaveCategoryName', 'Annual Leave')
                ->sum(fn ($row) => (float) ($row['accruedAmountInHours'] ?? 0));

            $trend[] = [
                'month' => Carbon::parse($monthKey . '-01')->format('M Y'),
                'accrued' => round($data['accrued'], 2),
                'taken' => round($data['taken'], 2),
                'cumulative_accrued' => round($cumulativeAccrued, 2),
                'cumulative_taken' => round($cumulativeTaken, 2),
                'net_balance' => round($netBalance, 2),
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

        if ($this->allOpenProjectsSelected($request->input('location_ids'))) {
            // All-projects mode: employees who actually worked in the period, as before.
            $activeEmployeeIds = Clock::whereIn('eh_location_id', array_unique($allEhLocationIds))
                ->where('clock_in', '>=', $dateFrom)
                ->where('clock_in', '<=', $dateTo)
                ->whereIn('status', ['Processed', 'Approved'])
                ->distinct()
                ->pluck('eh_employee_id')
                ->map(fn ($id) => (int) $id)
                ->toArray();
        } else {
            // Filtered: use the locations' kiosk rosters instead of clock activity, so
            // employees currently on leave (no clocks in range) still show, and crew
            // transferred away from the site don't.
            $activeEmployeeIds = Employee::whereHas('kiosks', function ($q) use ($allEhLocationIds) {
                $q->whereIn('kiosks.eh_location_id', array_unique($allEhLocationIds));
            })
                ->pluck('eh_employee_id')
                ->map(fn ($id) => (int) $id)
                ->toArray();
        }

        $employees = Employee::withTrashed()
            ->get(['eh_employee_id', 'name', 'preferred_name', 'external_id', 'start_date', 'deleted_at'])
            ->keyBy('eh_employee_id');

        $annualLeave = collect($balances)
            ->where('leaveCategoryName', 'Annual Leave')
            ->filter(function ($row) use ($activeEmployeeIds) {
                return in_array((int) $row['employeeId'], $activeEmployeeIds);
            })
            ->groupBy('employeeId')
            ->map(function ($rows) use ($employees, $asAtDate) {
                $row = $rows->first();
                $employee = $employees->get($row['employeeId']);
                $tenure = null;
                if ($employee?->start_date) {
                    $tenure = round(Carbon::parse($employee->start_date)->diffInMonths(Carbon::parse($asAtDate)) / 12, 1);
                }

                $totalHours = $rows->sum(fn ($r) => (float) ($r['accruedAmountInHours'] ?? 0));
                $totalLiability = $rows->sum(fn ($r) => (float) ($r['leavePlusLoading'] ?? $r['leaveValue'] ?? 0));

                return [
                    'employee_id' => $row['employeeId'],
                    'external_id' => $row['externalId'] ?? $employee?->external_id,
                    'name' => $employee?->display_name ?? trim($row['firstName'].' '.$row['surname']),
                    'balance_hours' => round($totalHours, 2),
                    'balance_days' => round($totalHours / 8, 2),
                    'liability' => round($totalLiability, 2),
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

    public function getSickLeaveIndicators(Request $request)
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

        // Get all eh_location_ids
        $selectedLocations = Location::whereIn('id', $locationIds)->get();
        $allEhLocationIds = [];
        foreach ($selectedLocations as $location) {
            $allEhLocationIds[] = $location->eh_location_id;
            $subIds = Location::where('eh_parent_id', $location->eh_location_id)
                ->pluck('eh_location_id')->toArray();
            $allEhLocationIds = array_merge($allEhLocationIds, $subIds);
        }
        $allEhLocationIds = array_unique($allEhLocationIds);

        $excludedWorkTypeIds = Worktype::where('name', 'like', '%Workcover%')
            ->pluck('eh_worktype_id')->toArray();

        $sickLeaveWorkTypeIds = Worktype::where('name', 'like', '%Personal%Carer%Leave%')
            ->pluck('eh_worktype_id')->toArray();

        $rdoWorkTypeIds = Worktype::where(function ($q) {
            $q->where('name', 'like', '%RDO Taken%')
              ->orWhere('name', 'like', '%Rostered Day Off Taken%');
        })->pluck('eh_worktype_id')->toArray();

        $publicHolidayWorkTypeIds = Worktype::where('name', 'like', '%Public Holiday%')
            ->pluck('eh_worktype_id')->toArray();

        // All-projects mode keeps the company-wide view; a narrower selection only
        // counts timesheets at the filtered locations.
        $clocksQuery = Clock::where('clock_in', '>=', $dateFrom)
            ->where('clock_in', '<=', $dateTo)
            ->where('status', 'Processed')
            ->whereNotIn('eh_worktype_id', $excludedWorkTypeIds)
            ->whereNotNull('hours_worked')
            ->where('hours_worked', '>', 0);

        if (!$this->allOpenProjectsSelected($locationIds)) {
            $clocksQuery->whereIn('eh_location_id', $allEhLocationIds);
        }

        $clocks = $clocksQuery
            ->select('eh_employee_id', 'eh_worktype_id', 'clock_in')
            ->get();

        // Group by employee
        $employeeClocks = $clocks->groupBy('eh_employee_id');

        $results = [];

        foreach ($employeeClocks as $employeeId => $empClocks) {
            // Get unique dates by type
            $sickDates = $empClocks->whereIn('eh_worktype_id', $sickLeaveWorkTypeIds)
                ->map(fn ($c) => Carbon::parse($c->clock_in)->toDateString())
                ->unique()->values()->toArray();

            if (empty($sickDates)) continue;

            $rdoDates = $empClocks->whereIn('eh_worktype_id', $rdoWorkTypeIds)
                ->map(fn ($c) => Carbon::parse($c->clock_in)->toDateString())
                ->unique()->values()->toArray();

            $phDates = $empClocks->whereIn('eh_worktype_id', $publicHolidayWorkTypeIds)
                ->map(fn ($c) => Carbon::parse($c->clock_in)->toDateString())
                ->unique()->values()->toArray();

            $rdoSet = array_flip($rdoDates);
            $phSet = array_flip($phDates);

            sort($sickDates);
            $sickDaysTaken = count($sickDates);

            // Build consecutive streaks and tag each date with its streak length
            $streaks = []; // array of arrays
            $currentStreak = [$sickDates[0]];
            for ($i = 1; $i < count($sickDates); $i++) {
                $prev = Carbon::parse($sickDates[$i - 1]);
                $nextExpected = $prev->copy()->addDay();
                while ($nextExpected->isWeekend()) $nextExpected->addDay();
                if ($nextExpected->toDateString() === $sickDates[$i]) {
                    $currentStreak[] = $sickDates[$i];
                } else {
                    $streaks[] = $currentStreak;
                    $currentStreak = [$sickDates[$i]];
                }
            }
            $streaks[] = $currentStreak;

            // Map each date to its streak length
            $dateStreakLength = [];
            $maxStreak = 0;
            foreach ($streaks as $streak) {
                $len = count($streak);
                $maxStreak = max($maxStreak, $len);
                foreach ($streak as $d) {
                    $dateStreakLength[$d] = $len;
                }
            }

            // Count indicators — both raw (all days) and adjusted (only days in short streaks ≤2)
            $sickOnMonday = 0;
            $sickOnFriday = 0;
            $sickBeforeRdo = 0;
            $sickAfterRdo = 0;
            $sickBeforePh = 0;
            $sickAfterPh = 0;
            $adjustedScore = 0;

            foreach ($sickDates as $dateStr) {
                $date = Carbon::parse($dateStr);
                $dow = $date->dayOfWeek;
                $isShort = $dateStreakLength[$dateStr] <= 2;

                $nextWorkDay = $date->copy()->addDay();
                while ($nextWorkDay->isWeekend()) $nextWorkDay->addDay();
                $prevWorkDay = $date->copy()->subDay();
                while ($prevWorkDay->isWeekend()) $prevWorkDay->subDay();

                $nextStr = $nextWorkDay->toDateString();
                $prevStr = $prevWorkDay->toDateString();

                // Hierarchy: PH > RDO > Mon/Fri
                $isBeforePh = isset($phSet[$nextStr]);
                $isAfterPh = isset($phSet[$prevStr]);
                $isBeforeRdo = isset($rdoSet[$nextStr]);
                $isAfterRdo = isset($rdoSet[$prevStr]);

                $dayScore = 0;
                if ($isBeforePh || $isAfterPh) {
                    if ($isBeforePh) { $sickBeforePh++; $dayScore++; }
                    if ($isAfterPh) { $sickAfterPh++; $dayScore++; }
                } elseif ($isBeforeRdo || $isAfterRdo) {
                    if ($isBeforeRdo) { $sickBeforeRdo++; $dayScore++; }
                    if ($isAfterRdo) { $sickAfterRdo++; $dayScore++; }
                } else {
                    if ($dow === Carbon::MONDAY) { $sickOnMonday++; $dayScore++; }
                    if ($dow === Carbon::FRIDAY) { $sickOnFriday++; $dayScore++; }
                }

                if ($isShort && $dayScore > 0) {
                    $adjustedScore += $dayScore;
                }
            }

            $sensitiveScore = $sickOnMonday + $sickOnFriday + $sickBeforeRdo + $sickAfterRdo + $sickBeforePh + $sickAfterPh;

            // Build notes
            $notes = [];
            if ($maxStreak >= 3 && $sensitiveScore > $adjustedScore) {
                $longDays = $sensitiveScore - $adjustedScore;
                $notes[] = "Sick streak ({$maxStreak}d) contributing {$longDays} to score";
            }

            if ($sensitiveScore === 0 && empty($notes)) continue;

            $results[] = [
                'employee_id' => $employeeId,
                'sick_days_taken' => $sickDaysTaken,
                'sick_on_monday' => $sickOnMonday,
                'sick_on_friday' => $sickOnFriday,
                'sick_before_rdo' => $sickBeforeRdo,
                'sick_after_rdo' => $sickAfterRdo,
                'sick_before_ph' => $sickBeforePh,
                'sick_after_ph' => $sickAfterPh,
                'sensitive_score' => $sensitiveScore,
                'adjusted_score' => $adjustedScore,
                'max_streak' => $maxStreak,
                'notes' => implode('; ', $notes),
            ];
        }

        // Sort by sensitive score descending
        usort($results, fn ($a, $b) => $b['sensitive_score'] <=> $a['sensitive_score']);

        // Resolve employee names
        $employeeIds = array_column($results, 'employee_id');
        $employees = Employee::withTrashed()
            ->whereIn('eh_employee_id', $employeeIds)
            ->get(['eh_employee_id', 'name', 'preferred_name', 'external_id', 'deleted_at'])
            ->keyBy('eh_employee_id');

        foreach ($results as &$row) {
            $emp = $employees->get($row['employee_id']);
            $row['name'] = $emp?->display_name ?? "Unknown ({$row['employee_id']})";
            $row['external_id'] = $emp?->external_id;
            $row['archived'] = $emp?->trashed() ?? false;
        }

        return response()->json($results);
    }

    public function getLeaveByEmploymentType(Request $request)
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

        // Casuals don't accrue leave in the pay system; their absences are
        // recorded via the prestart kiosk. Each absentee row = 1 day = 8 hrs.
        // Full-time/part-time leave is taken from clocks (Personal/Carer + Annual Leave worktypes).
        $casualDayHours = 8;

        // Resolve selected locations -> all eh_location_ids (self + children)
        $selectedLocations = Location::whereIn('id', $locationIds)->get();
        $allEhLocationIds = [];
        foreach ($selectedLocations as $location) {
            $allEhLocationIds[] = $location->eh_location_id;
            $subIds = Location::where('eh_parent_id', $location->eh_location_id)
                ->pluck('eh_location_id')->toArray();
            $allEhLocationIds = array_merge($allEhLocationIds, $subIds);
        }
        $allEhLocationIds = array_values(array_unique(array_filter($allEhLocationIds)));

        $sickLeaveWorkTypeIds = Worktype::where('name', 'like', '%Personal%Carer%Leave%')
            ->pluck('eh_worktype_id')->toArray();
        $annualLeaveWorkTypeIds = Worktype::where('name', 'like', '%Annual Leave%')
            ->pluck('eh_worktype_id')->toArray();
        $workcoverWorkTypeIds = Worktype::where('name', 'like', '%Workcover%')
            ->pluck('eh_worktype_id')->toArray();
        $allAbsenceWorkTypeIds = array_values(array_unique(array_merge(
            $sickLeaveWorkTypeIds, $annualLeaveWorkTypeIds, $workcoverWorkTypeIds
        )));

        // --- Full-time bucket (= Full Time + Part Time, anyone who accrues leave) ---
        $ftLikeTypes = ['Full Time', 'Part Time'];

        $sqlInList = fn (array $ids) => $ids ? implode(',', array_map('intval', $ids)) : '0';

        // Hours from clocks: sick + annual + total absence (sick+annual+workcover).
        $clockTotals = Clock::query()
            ->join('employees', 'employees.eh_employee_id', '=', 'clocks.eh_employee_id')
            ->whereIn('clocks.eh_location_id', $allEhLocationIds)
            ->where('clocks.clock_in', '>=', $dateFrom)
            ->where('clocks.clock_in', '<=', $dateTo)
            ->where('clocks.status', 'Processed')
            ->whereNotNull('clocks.hours_worked')
            ->where('clocks.hours_worked', '>', 0)
            ->whereIn('employees.employment_type', $ftLikeTypes)
            ->selectRaw('
                SUM(CASE WHEN clocks.eh_worktype_id IN ('.$sqlInList($sickLeaveWorkTypeIds).') THEN clocks.hours_worked ELSE 0 END) as sick_hours,
                SUM(CASE WHEN clocks.eh_worktype_id IN ('.$sqlInList($annualLeaveWorkTypeIds).') THEN clocks.hours_worked ELSE 0 END) as annual_hours,
                SUM(CASE WHEN clocks.eh_worktype_id IN ('.$sqlInList($allAbsenceWorkTypeIds).') THEN clocks.hours_worked ELSE 0 END) as all_hours
            ')
            ->first();

        $ftSickHours = (float) ($clockTotals->sick_hours ?? 0);
        $ftAnnualHours = (float) ($clockTotals->annual_hours ?? 0);
        $ftAllHours = (float) ($clockTotals->all_hours ?? 0);

        // Headcount of FT/PT employees who clocked anything (any worktype) in the period.
        $ftCount = Clock::query()
            ->join('employees', 'employees.eh_employee_id', '=', 'clocks.eh_employee_id')
            ->whereIn('clocks.eh_location_id', $allEhLocationIds)
            ->where('clocks.clock_in', '>=', $dateFrom)
            ->where('clocks.clock_in', '<=', $dateTo)
            ->whereIn('clocks.status', ['Processed', 'Approved'])
            ->whereIn('employees.employment_type', $ftLikeTypes)
            ->distinct()
            ->count('employees.id');

        // --- Casual bucket (derived from prestart absentees) ---
        // "All absences" = sick + annual + workcover (the reasons that are actual absences
        // from work, as opposed to other_project / not-rostered / training / rdo).
        $casualAbsenceReasons = ['sick_leave', 'annual_leave', 'workcover'];

        $absentees = PrestartAbsentee::query()
            ->join('daily_prestarts', 'daily_prestarts.id', '=', 'prestart_absentees.daily_prestart_id')
            ->whereIn('daily_prestarts.location_id', $locationIds)
            ->whereBetween('daily_prestarts.work_date', [$dateFrom->toDateString(), $dateTo->toDateString()])
            ->where('prestart_absentees.employment_type', 'Casual')
            ->whereIn('prestart_absentees.reason', $casualAbsenceReasons)
            ->selectRaw("
                SUM(CASE WHEN prestart_absentees.reason = 'sick_leave' THEN 1 ELSE 0 END) as sick_days,
                SUM(CASE WHEN prestart_absentees.reason = 'annual_leave' THEN 1 ELSE 0 END) as annual_days,
                COUNT(*) as all_days
            ")
            ->first();

        $casualSickHours = (float) ($absentees->sick_days ?? 0) * $casualDayHours;
        $casualAnnualHours = (float) ($absentees->annual_days ?? 0) * $casualDayHours;
        $casualAllHours = (float) ($absentees->all_days ?? 0) * $casualDayHours;

        // Casual headcount: unique casual employees seen on a prestart at the selected
        // locations during the period (signed in OR marked absent).
        $casualSignedIds = DailyPrestartSignature::query()
            ->join('daily_prestarts', 'daily_prestarts.id', '=', 'daily_prestart_signatures.daily_prestart_id')
            ->whereIn('daily_prestarts.location_id', $locationIds)
            ->whereBetween('daily_prestarts.work_date', [$dateFrom->toDateString(), $dateTo->toDateString()])
            ->where('daily_prestart_signatures.employment_type', 'Casual')
            ->whereNotNull('daily_prestart_signatures.employee_id')
            ->distinct()
            ->pluck('daily_prestart_signatures.employee_id')
            ->all();

        $casualAbsentIds = PrestartAbsentee::query()
            ->join('daily_prestarts', 'daily_prestarts.id', '=', 'prestart_absentees.daily_prestart_id')
            ->whereIn('daily_prestarts.location_id', $locationIds)
            ->whereBetween('daily_prestarts.work_date', [$dateFrom->toDateString(), $dateTo->toDateString()])
            ->where('prestart_absentees.employment_type', 'Casual')
            ->whereNotNull('prestart_absentees.employee_id')
            ->distinct()
            ->pluck('prestart_absentees.employee_id')
            ->all();

        $casualCount = count(array_unique(array_merge($casualSignedIds, $casualAbsentIds)));

        // Earliest casual absentee on file (any project) — used in the widget footer so a
        // manager can tell whether their filter pre-dates the data we have.
        $earliestCasualAbsenteeDate = PrestartAbsentee::query()
            ->join('daily_prestarts', 'daily_prestarts.id', '=', 'prestart_absentees.daily_prestart_id')
            ->where('prestart_absentees.employment_type', 'Casual')
            ->whereIn('prestart_absentees.reason', $casualAbsenceReasons)
            ->min('daily_prestarts.work_date');

        // --- Casual conversion pipeline (period-scoped) ---
        // Every hire starts as Casual. After 6 weeks they're either kept on as Casual
        // (retained) or moved to Full Time (converted). Period scope: employees whose
        // 6-week conversion-due-date falls within [date_from, date_to]. Project scope:
        // they must have appeared on a prestart at one of the selected projects (at any
        // time, not just the date range — their conversion was a decision made for them,
        // even if they didn't sign in during this exact period).
        $conversionWeeks = 6;

        // start_date range that produces a due date in [date_from, date_to].
        // due_date = start_date + 6w  =>  start_date = due_date - 6w
        $startDateMin = $dateFrom->copy()->subWeeks($conversionWeeks)->toDateString();
        $startDateMax = $dateTo->copy()->subWeeks($conversionWeeks)->toDateString();

        $pipelineProjectEmpIds = array_values(array_unique(array_merge(
            DailyPrestartSignature::query()
                ->join('daily_prestarts', 'daily_prestarts.id', '=', 'daily_prestart_signatures.daily_prestart_id')
                ->whereIn('daily_prestarts.location_id', $locationIds)
                ->whereNotNull('daily_prestart_signatures.employee_id')
                ->distinct()
                ->pluck('daily_prestart_signatures.employee_id')
                ->all(),
            PrestartAbsentee::query()
                ->join('daily_prestarts', 'daily_prestarts.id', '=', 'prestart_absentees.daily_prestart_id')
                ->whereIn('daily_prestarts.location_id', $locationIds)
                ->whereNotNull('prestart_absentees.employee_id')
                ->distinct()
                ->pluck('prestart_absentees.employee_id')
                ->all(),
        )));

        $pipelineCounts = ['converted' => 0, 'retained' => 0];
        if (!empty($pipelineProjectEmpIds)) {
            $pipelineRows = Employee::query()
                ->whereIn('id', $pipelineProjectEmpIds)
                ->whereNull('deleted_at')
                ->whereNotNull('start_date')
                ->where('start_date', '>=', '2000-01-01') // exclude sentinel/junk dates
                ->whereBetween('start_date', [$startDateMin, $startDateMax])
                ->get(['id', 'start_date', 'employment_type']);

            foreach ($pipelineRows as $emp) {
                if (in_array($emp->employment_type, ['Full Time', 'Part Time'], true)) {
                    $pipelineCounts['converted']++;
                } elseif ($emp->employment_type === 'Casual') {
                    $pipelineCounts['retained']++;
                }
                // employment_type blank/null → skip (can't classify)
            }
        }

        $pipelineEligible = $pipelineCounts['converted'] + $pipelineCounts['retained'];

        return response()->json([
            'sick_ft_hours' => round($ftSickHours, 2),
            'sick_casual_hours' => round($casualSickHours, 2),
            'annual_ft_hours' => round($ftAnnualHours, 2),
            'annual_casual_hours' => round($casualAnnualHours, 2),
            'all_ft_hours' => round($ftAllHours, 2),
            'all_casual_hours' => round($casualAllHours, 2),
            'ft_count' => $ftCount,
            'casual_count' => $casualCount,
            'earliest_casual_absentee_date' => $earliestCasualAbsenteeDate,
            'conversion' => [
                'converted_count' => $pipelineCounts['converted'],
                'retained_count' => $pipelineCounts['retained'],
                'eligible_count' => $pipelineEligible,
                'conversion_pct' => $pipelineEligible > 0 ? round(($pipelineCounts['converted'] / $pipelineEligible) * 100, 1) : 0,
                'retention_pct' => $pipelineEligible > 0 ? round(($pipelineCounts['retained'] / $pipelineEligible) * 100, 1) : 0,
                'conversion_weeks' => $conversionWeeks,
                'start_date_window' => ['from' => $startDateMin, 'to' => $startDateMax],
            ],
        ]);
    }

    public function getLeaveByEmploymentTypeDrill(Request $request)
    {
        $request->validate([
            'location_ids' => 'required|array|min:1',
            'location_ids.*' => 'integer|exists:locations,id',
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
            'bucket' => 'required|in:sick_ft,sick_casual,annual_ft,annual_casual,all_ft,all_casual,headcount_ft,headcount_casual,conversion_converted,conversion_retained',
        ]);

        $locationIds = $request->input('location_ids');
        $dateFrom = Carbon::parse($request->input('date_from'))->startOfDay();
        $dateTo = Carbon::parse($request->input('date_to'))->endOfDay();
        $bucket = $request->input('bucket');
        $casualDayHours = 8;

        // Resolve eh_location_ids (self + children) for clock-side queries.
        $selectedLocations = Location::whereIn('id', $locationIds)->get();
        $allEhLocationIds = [];
        foreach ($selectedLocations as $location) {
            $allEhLocationIds[] = $location->eh_location_id;
            $subIds = Location::where('eh_parent_id', $location->eh_location_id)
                ->pluck('eh_location_id')->toArray();
            $allEhLocationIds = array_merge($allEhLocationIds, $subIds);
        }
        $allEhLocationIds = array_values(array_unique(array_filter($allEhLocationIds)));

        $ftLikeTypes = ['Full Time', 'Part Time'];

        // Conversion pipeline drills — period-scoped by 6-week-after-start-date hitting the
        // selected date range, project-scoped by prestart presence at selected locations.
        if ($bucket === 'conversion_converted' || $bucket === 'conversion_retained') {
            $conversionWeeks = 6;
            $startDateMin = $dateFrom->copy()->subWeeks($conversionWeeks)->toDateString();
            $startDateMax = $dateTo->copy()->subWeeks($conversionWeeks)->toDateString();

            $pipelineProjectEmpIds = array_values(array_unique(array_merge(
                DailyPrestartSignature::query()
                    ->join('daily_prestarts', 'daily_prestarts.id', '=', 'daily_prestart_signatures.daily_prestart_id')
                    ->whereIn('daily_prestarts.location_id', $locationIds)
                    ->whereNotNull('daily_prestart_signatures.employee_id')
                    ->distinct()
                    ->pluck('daily_prestart_signatures.employee_id')->all(),
                PrestartAbsentee::query()
                    ->join('daily_prestarts', 'daily_prestarts.id', '=', 'prestart_absentees.daily_prestart_id')
                    ->whereIn('daily_prestarts.location_id', $locationIds)
                    ->whereNotNull('prestart_absentees.employee_id')
                    ->distinct()
                    ->pluck('prestart_absentees.employee_id')->all(),
            )));

            $targetTypes = $bucket === 'conversion_converted' ? $ftLikeTypes : ['Casual'];

            $rows = Employee::query()
                ->whereIn('id', $pipelineProjectEmpIds ?: [0])
                ->whereNull('deleted_at')
                ->whereNotNull('start_date')
                ->where('start_date', '>=', '2000-01-01')
                ->whereBetween('start_date', [$startDateMin, $startDateMax])
                ->whereIn('employment_type', $targetTypes)
                ->orderBy('start_date', 'desc')
                ->get(['id', 'name', 'preferred_name', 'external_id', 'start_date', 'employment_type']);

            $today = Carbon::today();
            $data = $rows->map(function ($emp) use ($conversionWeeks, $today) {
                $start = $emp->start_date instanceof \Carbon\Carbon ? $emp->start_date : Carbon::parse($emp->start_date);
                $dueDate = $start->copy()->addWeeks($conversionWeeks);
                return [
                    'employee_id' => $emp->id,
                    'name' => $emp->preferred_name ?: $emp->name,
                    'external_id' => $emp->external_id,
                    'employment_type' => $emp->employment_type,
                    'start_date' => $start->toDateString(),
                    'due_date' => $dueDate->toDateString(),
                    'weeks_since_start' => (int) round($start->diffInDays($today) / 7),
                    'archived' => false,
                ];
            })->values();

            return response()->json([
                'bucket' => $bucket,
                'unit' => 'employees',
                'rows' => $data,
            ]);
        }

        $isCasual = str_ends_with($bucket, '_casual');

        if (!$isCasual) {
            // FT cohort — pull from clocks. Worktype scope depends on bucket.
            $sickIds = Worktype::where('name', 'like', '%Personal%Carer%Leave%')->pluck('eh_worktype_id')->toArray();
            $annualIds = Worktype::where('name', 'like', '%Annual Leave%')->pluck('eh_worktype_id')->toArray();
            $workcoverIds = Worktype::where('name', 'like', '%Workcover%')->pluck('eh_worktype_id')->toArray();

            $workTypeIds = match ($bucket) {
                'sick_ft' => $sickIds,
                'annual_ft' => $annualIds,
                'all_ft' => array_values(array_unique(array_merge($sickIds, $annualIds, $workcoverIds))),
                'headcount_ft' => [], // any worktype
                default => [],
            };

            $query = Clock::query()
                ->join('employees', 'employees.eh_employee_id', '=', 'clocks.eh_employee_id')
                ->leftJoin('worktypes', 'worktypes.eh_worktype_id', '=', 'clocks.eh_worktype_id')
                ->whereIn('clocks.eh_location_id', $allEhLocationIds)
                ->where('clocks.clock_in', '>=', $dateFrom)
                ->where('clocks.clock_in', '<=', $dateTo)
                ->whereIn('clocks.status', $bucket === 'headcount_ft' ? ['Processed', 'Approved'] : ['Processed'])
                ->whereIn('employees.employment_type', $ftLikeTypes);

            if ($bucket === 'headcount_ft') {
                // Distinct employee summary — total hours across any worktype in range.
                $rows = $query
                    ->whereNotNull('clocks.hours_worked')
                    ->where('clocks.hours_worked', '>', 0)
                    ->groupBy('employees.id', 'employees.name', 'employees.preferred_name', 'employees.external_id', 'employees.employment_type', 'employees.deleted_at')
                    ->selectRaw('
                        employees.id as employee_id,
                        employees.name,
                        employees.preferred_name,
                        employees.external_id,
                        employees.employment_type,
                        employees.deleted_at,
                        SUM(clocks.hours_worked) as hours,
                        COUNT(DISTINCT DATE(clocks.clock_in)) as days
                    ')
                    ->orderByDesc('hours')
                    ->get();
            } else {
                $rows = $query
                    ->whereIn('clocks.eh_worktype_id', $workTypeIds ?: [0])
                    ->whereNotNull('clocks.hours_worked')
                    ->where('clocks.hours_worked', '>', 0)
                    ->groupBy('employees.id', 'employees.name', 'employees.preferred_name', 'employees.external_id', 'employees.employment_type', 'employees.deleted_at')
                    ->selectRaw('
                        employees.id as employee_id,
                        employees.name,
                        employees.preferred_name,
                        employees.external_id,
                        employees.employment_type,
                        employees.deleted_at,
                        SUM(clocks.hours_worked) as hours,
                        COUNT(DISTINCT DATE(clocks.clock_in)) as days
                    ')
                    ->orderByDesc('hours')
                    ->get();
            }

            $data = $rows->map(fn ($r) => [
                'employee_id' => $r->employee_id,
                'name' => $r->preferred_name ?: $r->name,
                'external_id' => $r->external_id,
                'employment_type' => $r->employment_type,
                'hours' => round((float) $r->hours, 2),
                'days' => (int) $r->days,
                'archived' => $r->deleted_at !== null,
            ])->values();

            return response()->json([
                'bucket' => $bucket,
                'unit' => 'hours',
                'rows' => $data,
            ]);
        }

        // Casual cohort — pull from prestart absentees / signatures.
        if ($bucket === 'headcount_casual') {
            $signed = DailyPrestartSignature::query()
                ->join('daily_prestarts', 'daily_prestarts.id', '=', 'daily_prestart_signatures.daily_prestart_id')
                ->leftJoin('employees', 'employees.id', '=', 'daily_prestart_signatures.employee_id')
                ->whereIn('daily_prestarts.location_id', $locationIds)
                ->whereBetween('daily_prestarts.work_date', [$dateFrom->toDateString(), $dateTo->toDateString()])
                ->where('daily_prestart_signatures.employment_type', 'Casual')
                ->whereNotNull('daily_prestart_signatures.employee_id')
                ->groupBy('employees.id', 'employees.name', 'employees.preferred_name', 'employees.external_id', 'employees.deleted_at')
                ->selectRaw('
                    employees.id as employee_id,
                    employees.name,
                    employees.preferred_name,
                    employees.external_id,
                    employees.deleted_at,
                    COUNT(DISTINCT daily_prestarts.work_date) as days_signed,
                    MAX(daily_prestarts.work_date) as last_seen
                ')
                ->get()
                ->keyBy('employee_id');

            $absent = PrestartAbsentee::query()
                ->join('daily_prestarts', 'daily_prestarts.id', '=', 'prestart_absentees.daily_prestart_id')
                ->whereIn('daily_prestarts.location_id', $locationIds)
                ->whereBetween('daily_prestarts.work_date', [$dateFrom->toDateString(), $dateTo->toDateString()])
                ->where('prestart_absentees.employment_type', 'Casual')
                ->whereNotNull('prestart_absentees.employee_id')
                ->groupBy('prestart_absentees.employee_id')
                ->selectRaw('
                    prestart_absentees.employee_id,
                    COUNT(DISTINCT daily_prestarts.work_date) as days_absent,
                    MAX(daily_prestarts.work_date) as last_absent
                ')
                ->get()
                ->keyBy('employee_id');

            $allEmpIds = $signed->keys()->merge($absent->keys())->unique();
            $employees = Employee::withTrashed()
                ->whereIn('id', $allEmpIds)
                ->get(['id', 'name', 'preferred_name', 'external_id', 'deleted_at'])
                ->keyBy('id');

            $data = $allEmpIds->map(function ($id) use ($signed, $absent, $employees) {
                $s = $signed->get($id);
                $a = $absent->get($id);
                $emp = $employees->get($id);
                $lastSeen = collect([$s?->last_seen, $a?->last_absent])->filter()->max();
                return [
                    'employee_id' => (int) $id,
                    'name' => $emp?->preferred_name ?: $emp?->name ?: 'Unknown',
                    'external_id' => $emp?->external_id,
                    'days_signed' => (int) ($s?->days_signed ?? 0),
                    'days_absent' => (int) ($a?->days_absent ?? 0),
                    'last_seen' => $lastSeen,
                    'archived' => $emp?->deleted_at !== null,
                ];
            })->sortByDesc('days_signed')->values();

            return response()->json([
                'bucket' => $bucket,
                'unit' => 'days',
                'rows' => $data,
            ]);
        }

        // Casual sick / annual / all — aggregate prestart_absentees.
        $reasons = match ($bucket) {
            'sick_casual' => ['sick_leave'],
            'annual_casual' => ['annual_leave'],
            'all_casual' => ['sick_leave', 'annual_leave', 'workcover'],
        };

        $rows = PrestartAbsentee::query()
            ->join('daily_prestarts', 'daily_prestarts.id', '=', 'prestart_absentees.daily_prestart_id')
            ->leftJoin('employees', 'employees.id', '=', 'prestart_absentees.employee_id')
            ->whereIn('daily_prestarts.location_id', $locationIds)
            ->whereBetween('daily_prestarts.work_date', [$dateFrom->toDateString(), $dateTo->toDateString()])
            ->where('prestart_absentees.employment_type', 'Casual')
            ->whereIn('prestart_absentees.reason', $reasons)
            ->whereNotNull('prestart_absentees.employee_id')
            ->orderBy('employees.name')
            ->orderBy('daily_prestarts.work_date')
            ->get([
                'prestart_absentees.id',
                'prestart_absentees.employee_id',
                'prestart_absentees.reason',
                'prestart_absentees.notes',
                'daily_prestarts.work_date',
                'employees.name',
                'employees.preferred_name',
                'employees.external_id',
                'employees.deleted_at',
            ]);

        // Group by employee.
        $byEmployee = $rows->groupBy('employee_id')->map(function ($empRows) use ($casualDayHours) {
            $first = $empRows->first();
            $byReason = $empRows->groupBy('reason')->map->count();
            $dates = $empRows->map(fn ($r) => [
                'date' => (string) $r->work_date,
                'reason' => $r->reason,
                'notes' => $r->notes,
            ])->values();

            return [
                'employee_id' => (int) $first->employee_id,
                'name' => $first->preferred_name ?: $first->name ?: 'Unknown',
                'external_id' => $first->external_id,
                'days' => $empRows->count(),
                'hours' => round($empRows->count() * $casualDayHours, 2),
                'sick_days' => (int) ($byReason['sick_leave'] ?? 0),
                'annual_days' => (int) ($byReason['annual_leave'] ?? 0),
                'workcover_days' => (int) ($byReason['workcover'] ?? 0),
                'dates' => $dates,
                'archived' => $first->deleted_at !== null,
            ];
        })->sortByDesc('days')->values();

        return response()->json([
            'bucket' => $bucket,
            'unit' => 'days',
            'rows' => $byEmployee,
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
