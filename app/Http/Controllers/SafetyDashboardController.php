<?php

namespace App\Http\Controllers;

use App\Imports\IncidentReportImport;
use App\Models\Clock;
use App\Models\IncidentReport;
use App\Models\Location;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class SafetyDashboardController extends Controller
{
    public function index()
    {
        $now = now();

        return Inertia::render('reports/safety-dashboard', [
            'currentMonth' => $now->month,
            'currentYear' => $now->year,
            'lastImport' => IncidentReport::max('updated_at'),
            'totalRecords' => IncidentReport::count(),
        ]);
    }

    public function importPage()
    {
        return Inertia::render('reports/safety-dashboard-import', [
            'lastImport' => IncidentReport::max('updated_at'),
            'totalRecords' => IncidentReport::count(),
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

        $incidents = IncidentReport::forMonth($year, $month)->get();

        $rows = $this->aggregateByProject($incidents);
        $totals = $this->computeTotals($rows);

        return response()->json([
            'success' => true,
            'rows' => $rows,
            'totals' => $totals,
        ]);
    }

    public function getFYData(Request $request)
    {
        $now = now();
        $currentMonth = $now->month;
        $currentYear = $now->year;

        if ($currentMonth >= 7) {
            $fyStartYear = $currentYear;
            $fyEndYear = $currentYear + 1;
        } else {
            $fyStartYear = $currentYear - 1;
            $fyEndYear = $currentYear;
        }

        $fyLabel = "FY{$fyStartYear}/{$fyEndYear}";

        $incidents = IncidentReport::forFinancialYear($fyStartYear)->get();
        $rows = $this->aggregateByProject($incidents);

        // Build man hours per project using location hierarchy
        $manHours = $this->getManHoursByProject($fyStartYear, $fyEndYear);

        // Match incident project names to project locations and merge man hours + LTIFR
        $projectLocationMap = $this->buildProjectNameToLocationMap();
        foreach ($rows as &$row) {
            // Sum man hours across all matched project locations (e.g., DGC → DGC00 + DGC01 + DGC02)
            $locationIds = $projectLocationMap[$row['project']] ?? [];
            if (empty($locationIds) && $row['location_id']) {
                $locationIds = [$row['location_id']];
            }
            $hours = 0;
            foreach ($locationIds as $locId) {
                $hours += (float) ($manHours[$locId] ?? 0);
            }
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

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        $import = new IncidentReportImport(auth()->id());
        Excel::import($import, $request->file('file'));

        return response()->json([
            'success' => true,
            'imported' => $import->importedCount,
            'skipped' => $import->skippedCount,
            'errors' => $import->errors,
            'total_records' => IncidentReport::count(),
            'last_import' => now()->toIso8601String(),
        ]);
    }

    /**
     * Get man hours per project location by aggregating clock hours across all descendant locations.
     * Returns [location_id => total_hours].
     */
    private function getManHoursByProject(int $fyStartYear, int $fyEndYear): array
    {
        // Get project-level locations (children of "Jobs" nodes), excluding SWC company
        $swcEhId = Location::where('name', 'SWC')->value('eh_location_id');
        $jobsEhIds = Location::where('name', 'Jobs')
            ->when($swcEhId, fn ($q) => $q->where('eh_parent_id', '!=', $swcEhId))
            ->pluck('eh_location_id');
        $projects = Location::whereIn('eh_parent_id', $jobsEhIds)
            ->get(['id', 'name', 'eh_location_id']);

        // Build parent→children map for the entire location tree
        $allLocations = Location::whereNotNull('eh_location_id')
            ->get(['id', 'eh_location_id', 'eh_parent_id']);
        $childrenMap = [];
        foreach ($allLocations as $loc) {
            if ($loc->eh_parent_id) {
                $childrenMap[$loc->eh_parent_id][] = $loc->eh_location_id;
            }
        }

        // For each project, recursively collect all descendant eh_location_ids
        $projectDescendants = [];
        foreach ($projects as $project) {
            $descendants = [$project->eh_location_id];
            $queue = [$project->eh_location_id];
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
        // Only count processed clocks with base-rate work types (01-01, 03-01, 05-01, 07-01)
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

    /**
     * Build a mapping of incident project_name → project location_id.
     * Uses the same fuzzy matching logic as the import class.
     */
    private function buildProjectNameToLocationMap(): array
    {
        $swcEhId = Location::where('name', 'SWC')->value('eh_location_id');
        $jobsEhIds = Location::where('name', 'Jobs')
            ->when($swcEhId, fn ($q) => $q->where('eh_parent_id', '!=', $swcEhId))
            ->pluck('eh_location_id');
        $projects = Location::whereIn('eh_parent_id', $jobsEhIds)
            ->get(['id', 'name', 'eh_location_id', 'external_id']);

        $incidentNames = IncidentReport::select('project_name')
            ->distinct()
            ->pluck('project_name');

        $map = []; // project_name => [location_id, location_id, ...]
        foreach ($incidentNames as $projectName) {
            if (! $projectName) {
                continue;
            }

            // Strategy 1: Location name contains the project name
            $candidates = $projects->filter(
                fn ($loc) => stripos($loc->name, $projectName) !== false
            );
            if ($candidates->isNotEmpty()) {
                $map[$projectName] = $candidates->pluck('id')->all();
                continue;
            }

            // Strategy 2: Display name after code prefix matches
            $candidates = $projects->filter(function ($loc) use ($projectName) {
                $parts = explode(' - ', $loc->name, 2);
                $displayName = $parts[1] ?? $parts[0];

                return stripos($displayName, $projectName) !== false
                    || stripos($projectName, $displayName) !== false;
            });
            if ($candidates->isNotEmpty()) {
                $map[$projectName] = $candidates->pluck('id')->all();
            }
        }

        return $map;
    }

    private function aggregateByProject($incidents): array
    {
        $grouped = $incidents->groupBy('project_name');
        $rows = [];

        foreach ($grouped as $project => $records) {
            // Build type of injuries string: "2x Back Sprain/Strain, 1x Eye Foreign Body"
            $injuryTypes = $records
                ->filter(fn ($r) => $r->body_location || $r->nature_of_injury)
                ->groupBy(fn ($r) => trim(($r->body_location ?? '') . ' ' . ($r->nature_of_injury ?? '')))
                ->map(fn ($group, $key) => count($group) . 'x ' . $key)
                ->values()
                ->implode(', ');

            $rows[] = [
                'project' => $project,
                'location_id' => $records->first()->location_id,
                'reported_injuries' => $records->count(),
                'type_of_injuries' => $injuryTypes ?: '-',
                'wcq_claims' => $records->where('workcover_claim', true)->count(),
                'lti_count' => $records->where('incident_type', 'LTI')->count(),
                'total_days_lost' => $records->sum('days_lost'),
                'mti_count' => $records->where('incident_type', 'MTI')->count(),
                'days_suitable_duties' => $records->sum('days_suitable_duties'),
                'first_aid_count' => $records->where('incident_type', 'First Aid Only')->count(),
                'report_only_count' => $records->where('incident_type', 'Report Only')->count(),
                'near_miss_count' => $records->where('incident_type', 'Near Miss')->count(),
                'medical_expenses' => round($records->sum('medical_expenses_non_workcover'), 2),
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
