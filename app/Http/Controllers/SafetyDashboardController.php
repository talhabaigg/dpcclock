<?php

namespace App\Http\Controllers;

use App\Models\Clock;
use App\Models\Injury;
use App\Models\Location;
use App\Models\TimesheetEvent;
use App\Models\Worktype;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class SafetyDashboardController extends Controller
{
    public function index(Request $request)
    {
        $now = now();

        return Inertia::render('reports/safety-dashboard', [
            'currentMonth' => $request->filled('month') ? (int) $request->month : $now->month,
            'currentYear' => $request->filled('year') ? (int) $request->year : $now->year,
            'totalRecords' => Injury::count(),
        ]);
    }

    public function getMonthlyData(Request $request)
    {
        $request->validate([
            'year' => 'required|integer|min:2000|max:2100',
            'month' => 'required|integer|min:1|max:12',
        ]);

        $year = (int) $request->year;
        $month = (int) $request->month;

        $injuries = Injury::with('location.projectGroup')->forMonth($year, $month)->get();

        $rows = $this->aggregateByProject($injuries);

        // Workcover days lost from clock hours (same logic as PDF)
        $workcoverWorktypeId = Worktype::where('name', 'Workcover')->value('eh_worktype_id');
        if ($workcoverWorktypeId) {
            $wcHoursByLocation = Clock::where('eh_worktype_id', $workcoverWorktypeId)
                ->whereYear('clock_in', $year)
                ->whereMonth('clock_in', $month)
                ->whereNotNull('clock_out')
                ->select('eh_location_id', DB::raw('SUM(hours_worked) as total_hours'))
                ->groupBy('eh_location_id')
                ->pluck('total_hours', 'eh_location_id');

            if ($wcHoursByLocation->isNotEmpty()) {
                $ehLocationToProject = $this->buildLocationToProjectMap($wcHoursByLocation->keys()->all());

                foreach ($rows as &$mRow) {
                    $mRow['total_days_lost'] = 0;
                }
                unset($mRow);

                $daysByProject = [];
                foreach ($wcHoursByLocation as $ehLocId => $hours) {
                    $project = $ehLocationToProject[$ehLocId] ?? 'Others';
                    $daysByProject[$project] = ($daysByProject[$project] ?? 0) + round((float) $hours / 8, 1);
                }

                foreach ($daysByProject as $project => $days) {
                    $found = false;
                    foreach ($rows as &$mRow) {
                        if ($mRow['project'] === $project) {
                            $mRow['total_days_lost'] = $days;
                            $found = true;
                            break;
                        }
                    }
                    unset($mRow);

                    if (! $found && $days > 0) {
                        $rows[] = [
                            'project' => $project,
                            'location_id' => null,
                            'reported_injuries' => 0,
                            'type_of_injuries' => '-',
                            'wcq_claims' => 0,
                            'lti_count' => 0,
                            'total_days_lost' => $days,
                            'mti_count' => 0,
                            'days_suitable_duties' => 0,
                            'first_aid_count' => 0,
                            'report_only_count' => 0,
                            'near_miss_count' => 0,
                            'medical_expenses' => 0,
                        ];
                    }
                }
            }
        }

        // Suitable duties days from date ranges overlapping this month
        $monthStart = Carbon::create($year, $month, 1)->startOfDay();
        $monthEnd = $monthStart->copy()->endOfMonth();

        $suitableDutiesInjuries = Injury::with('location.projectGroup')
            ->whereNotNull('suitable_duties_from')
            ->where('suitable_duties_from', '<=', $monthEnd->toDateString())
            ->where(function ($q) use ($monthStart) {
                $q->whereNull('suitable_duties_to')
                  ->orWhere('suitable_duties_to', '>=', $monthStart->toDateString());
            })
            ->get();

        if ($suitableDutiesInjuries->isNotEmpty()) {
            $excludedDates = TimesheetEvent::whereIn('type', ['public_holiday', 'rdo'])
                ->where('start', '<=', $monthEnd->toDateString())
                ->where('end', '>=', $monthStart->toDateString())
                ->get()
                ->flatMap(function ($event) use ($monthStart, $monthEnd) {
                    $dates = [];
                    $s = Carbon::parse($event->start)->max($monthStart);
                    $e = Carbon::parse($event->end)->min($monthEnd);
                    for ($d = $s->copy(); $d->lte($e); $d->addDay()) {
                        $dates[] = $d->toDateString();
                    }
                    return $dates;
                })
                ->unique()
                ->toArray();

            foreach ($rows as &$mRow) {
                $mRow['days_suitable_duties'] = 0;
            }
            unset($mRow);

            foreach ($suitableDutiesInjuries as $injury) {
                $today = Carbon::today();
                $effectiveEnd = $monthEnd->gt($today) ? $today : $monthEnd;
                $from = Carbon::parse($injury->suitable_duties_from)->max($monthStart);
                $to = $injury->suitable_duties_to
                    ? Carbon::parse($injury->suitable_duties_to)->min($effectiveEnd)
                    : $effectiveEnd->copy();

                $days = 0;
                for ($d = $from->copy(); $d->lte($to); $d->addDay()) {
                    if ($d->isWeekend() || in_array($d->toDateString(), $excludedDates)) {
                        continue;
                    }
                    $days++;
                }

                if ($days > 0) {
                    $loc = $injury->location;
                    $project = 'Others';
                    if ($loc) {
                        $project = $loc->project_group_id
                            ? ($loc->projectGroup?->name ?? $loc->name)
                            : $loc->name;
                    }

                    $found = false;
                    foreach ($rows as &$mRow) {
                        if ($mRow['project'] === $project) {
                            $mRow['days_suitable_duties'] += $days;
                            $found = true;
                            break;
                        }
                    }
                    unset($mRow);

                    if (! $found) {
                        $rows[] = [
                            'project' => $project,
                            'location_id' => $loc?->project_group_id ?? $loc?->id,
                            'reported_injuries' => 0,
                            'type_of_injuries' => '-',
                            'wcq_claims' => 0,
                            'lti_count' => 0,
                            'total_days_lost' => 0,
                            'mti_count' => 0,
                            'days_suitable_duties' => $days,
                            'first_aid_count' => 0,
                            'report_only_count' => 0,
                            'near_miss_count' => 0,
                            'medical_expenses' => 0,
                        ];
                    }
                }
            }
        }

        $totals = $this->computeTotals($rows);

        return response()->json([
            'success' => true,
            'rows' => $rows,
            'totals' => $totals,
        ]);
    }

    public function getFYData(Request $request)
    {
        $request->validate([
            'year' => 'nullable|integer|min:2000|max:2100',
            'month' => 'nullable|integer|min:1|max:12',
        ]);

        $selectedYear = $request->filled('year') ? (int) $request->year : now()->year;
        $selectedMonth = $request->filled('month') ? (int) $request->month : now()->month;

        // Determine FY based on selected month/year
        $fyStartYear = $selectedMonth >= 7 ? $selectedYear : $selectedYear - 1;
        $fyEndYear = $fyStartYear + 1;

        $fyLabel = "FY{$fyStartYear}/{$fyEndYear}";

        // FY to date: from July of FY start year up to end of selected month
        $fyStart = "{$fyStartYear}-07-01";
        $fyEnd = date('Y-m-t', mktime(0, 0, 0, $selectedMonth, 1, $selectedYear));

        $injuries = Injury::with('location.projectGroup')
            ->whereBetween('occurred_at', [$fyStart, $fyEnd])
            ->get();
        $rows = $this->aggregateByProject($injuries);

        // Build man hours per project using location hierarchy
        $manHours = $this->getManHoursByProject($fyStartYear, $fyEndYear);

        foreach ($rows as &$row) {
            $hours = (float) ($manHours[$row['location_id']] ?? 0);
            $row['man_hours'] = round($hours, 0);
            $row['ltifr'] = $row['man_hours'] > 0
                ? round(($row['lti_count'] / $row['man_hours']) * 1_000_000, 2)
                : null;
        }

        $totals = $this->computeTotals($rows);
        $totals['man_hours'] = array_sum(array_column($rows, 'man_hours'));
        $totals['ltifr'] = $totals['man_hours'] > 0
            ? round(($totals['lti_count'] / $totals['man_hours']) * 1_000_000, 2)
            : null;

        // Monthly trend from the same injuries collection
        $monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        $trend = [];
        // Build all months from FY start to selected month
        $cursor = Carbon::create($fyStartYear, 7, 1);
        $end = Carbon::create($selectedYear, $selectedMonth, 1);
        while ($cursor->lte($end)) {
            $key = $cursor->format('Y-m');
            $trend[$key] = [
                'month' => $monthNames[$cursor->month - 1].' '.$cursor->format('y'),
                'injuries' => 0,
                'lti' => 0,
                'near_miss' => 0,
            ];
            $cursor->addMonth();
        }
        foreach ($injuries as $injury) {
            $key = Carbon::parse($injury->occurred_at)->format('Y-m');
            if (isset($trend[$key])) {
                $trend[$key]['injuries']++;
                if ($injury->report_type === 'lti') {
                    $trend[$key]['lti']++;
                }
                if ($injury->incident === 'near_miss') {
                    $trend[$key]['near_miss']++;
                }
            }
        }

        return response()->json([
            'success' => true,
            'rows' => $rows,
            'totals' => $totals,
            'fy_label' => $fyLabel,
            'monthly_trend' => array_values($trend),
        ]);
    }

    /**
     * Get man hours per project location by aggregating clock hours across all descendant locations.
     * Returns [location_id => total_hours].
     */
    private function getManHoursByProject(int $fyStartYear, int $fyEndYear): array
    {
        // Get all project-level locations (children of "Jobs" nodes)
        $jobsEhIds = Location::where('name', 'Jobs')->pluck('eh_location_id');
        $projects = Location::whereIn('eh_parent_id', $jobsEhIds)
            ->get(['id', 'name', 'eh_location_id', 'project_group_id']);

        // Build parent→children map for the entire location tree
        $allLocations = Location::whereNotNull('eh_location_id')
            ->get(['id', 'eh_location_id', 'eh_parent_id']);
        $childrenMap = [];
        foreach ($allLocations as $loc) {
            if ($loc->eh_parent_id) {
                $childrenMap[$loc->eh_parent_id][] = $loc->eh_location_id;
            }
        }

        // Collect descendants per project (including grouped members' trees)
        $projectDescendants = [];
        foreach ($projects as $project) {
            // Skip members — their hours will be counted under the primary
            if ($project->project_group_id) {
                continue;
            }

            // Collect this project's descendants
            $descendants = [$project->eh_location_id];
            $queue = [$project->eh_location_id];

            // Also include descendants of any group members
            $members = $projects->where('project_group_id', $project->id);
            foreach ($members as $member) {
                $descendants[] = $member->eh_location_id;
                $queue[] = $member->eh_location_id;
            }

            while ($queue) {
                $current = array_shift($queue);
                foreach ($childrenMap[$current] ?? [] as $childEhId) {
                    $descendants[] = $childEhId;
                    $queue[] = $childEhId;
                }
            }
            $projectDescendants[$project->id] = $descendants;
        }

        // Flatten all descendant eh_location_ids and query clocks once
        $allEhIds = collect($projectDescendants)->flatten()->unique()->values()->all();
        $baseRateWorktypeIds = Worktype::whereIn('eh_external_id', ['01-01', '03-01', '05-01', '07-01'])
            ->pluck('eh_worktype_id');
        $clockHours = Clock::whereIn('eh_location_id', $allEhIds)
            ->whereBetween('clock_in', ["{$fyStartYear}-07-01", "{$fyEndYear}-06-30"])
            ->whereNotNull('clock_out')
            ->where('status', 'processed')
            ->whereIn('eh_worktype_id', $baseRateWorktypeIds)
            ->select('eh_location_id', DB::raw('SUM(hours_worked) as total_hours'))
            ->groupBy('eh_location_id')
            ->pluck('total_hours', 'eh_location_id');

        // Aggregate per project
        $result = [];
        foreach ($projectDescendants as $projectId => $ehIds) {
            $total = 0;
            foreach ($ehIds as $ehId) {
                $total += (float) ($clockHours[$ehId] ?? 0);
            }
            if ($total > 0) {
                $result[$projectId] = $total;
            }
        }

        return $result;
    }

    private function aggregateByProject($injuries): array
    {
        // Resolve each injury to its project group primary location
        $grouped = $injuries->groupBy(function ($injury) {
            $location = $injury->location;
            if (! $location) {
                return 'Others';
            }
            // If this location is a group member, use the primary's name
            if ($location->project_group_id) {
                return $location->projectGroup?->name ?? $location->name;
            }
            return $location->name;
        });
        $rows = [];

        foreach ($grouped as $project => $records) {
            // Build type of injuries string from natures JSON
            $natureCounts = [];
            foreach ($records as $record) {
                if (is_array($record->natures)) {
                    foreach ($record->natures as $key) {
                        $label = Injury::NATURE_OPTIONS[$key] ?? $key;
                        $natureCounts[$label] = ($natureCounts[$label] ?? 0) + 1;
                    }
                }
            }
            $injuryTypes = collect($natureCounts)
                ->map(fn ($count, $label) => "{$count}x {$label}")
                ->implode(', ');

            // Resolve to primary location ID for man hours matching
            $firstLoc = $records->first()->location;
            $primaryLocationId = $firstLoc
                ? ($firstLoc->project_group_id ?? $firstLoc->id)
                : null;

            $rows[] = [
                'project' => $project,
                'location_id' => $primaryLocationId,
                'reported_injuries' => $records->count(),
                'type_of_injuries' => $injuryTypes ?: '-',
                'wcq_claims' => $records->where('work_cover_claim', true)->count(),
                'lti_count' => $records->where('report_type', 'lti')->count(),
                'total_days_lost' => $records->sum('work_days_missed'),
                'mti_count' => $records->where('report_type', 'mti')->count(),
                'days_suitable_duties' => $records->sum('computed_suitable_duties_days'),
                'first_aid_count' => $records->where('report_type', 'first_aid')->count(),
                'report_only_count' => $records->where('report_type', 'report')->count(),
                'near_miss_count' => $records->where('incident', 'near_miss')->count(),
                'medical_expenses' => round($records->sum('medical_expenses'), 2),
            ];
        }

        return $rows;
    }

    private function computeTotals(array $rows): array
    {
        return [
            'reported_injuries' => array_sum(array_column($rows, 'reported_injuries')),
            'wcq_claims' => array_sum(array_column($rows, 'wcq_claims')),
            'lti_count' => array_sum(array_column($rows, 'lti_count')),
            'total_days_lost' => array_sum(array_column($rows, 'total_days_lost')),
            'mti_count' => array_sum(array_column($rows, 'mti_count')),
            'days_suitable_duties' => array_sum(array_column($rows, 'days_suitable_duties')),
            'first_aid_count' => array_sum(array_column($rows, 'first_aid_count')),
            'report_only_count' => array_sum(array_column($rows, 'report_only_count')),
            'near_miss_count' => array_sum(array_column($rows, 'near_miss_count')),
            'medical_expenses' => round(array_sum(array_column($rows, 'medical_expenses')), 2),
        ];
    }

    private function buildLocationToProjectMap(array $ehLocationIds): array
    {
        $jobsEhIds = Location::where('name', 'Jobs')->pluck('eh_location_id')->all();

        $projects = Location::whereIn('eh_parent_id', $jobsEhIds)
            ->get(['id', 'name', 'eh_location_id', 'eh_parent_id', 'project_group_id']);

        $allLocations = Location::whereNotNull('eh_location_id')
            ->get(['id', 'name', 'eh_location_id', 'eh_parent_id', 'project_group_id']);
        $locationByEhId = $allLocations->keyBy('eh_location_id');

        $map = [];
        foreach ($ehLocationIds as $ehId) {
            $current = $ehId;
            $projectName = 'Others';
            $visited = [];

            while ($current && ! in_array($current, $visited)) {
                $visited[] = $current;

                $loc = $locationByEhId[$current] ?? null;
                if ($loc && in_array($loc->eh_parent_id, $jobsEhIds)) {
                    if ($loc->project_group_id) {
                        $group = $projects->firstWhere('id', $loc->project_group_id);
                        $projectName = $group?->name ?? $loc->name;
                    } else {
                        $projectName = $loc->name;
                    }
                    break;
                }

                $current = $loc?->eh_parent_id;
            }

            $map[$ehId] = $projectName;
        }

        return $map;
    }
}
