<?php

namespace App\Http\Controllers;

use App\Models\Clock;
use App\Models\Injury;
use App\Models\Location;
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

        return response()->json([
            'success' => true,
            'rows' => $rows,
            'totals' => $totals,
            'fy_label' => $fyLabel,
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
        $baseRateWorktypeIds = \App\Models\Worktype::whereIn('eh_external_id', ['01-01', '03-01', '05-01', '07-01'])
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
                'days_suitable_duties' => $records->sum('days_suitable_duties'),
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
}
