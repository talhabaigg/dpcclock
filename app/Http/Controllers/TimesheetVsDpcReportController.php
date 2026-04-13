<?php

namespace App\Http\Controllers;

use App\Models\Clock;
use App\Models\Location;
use App\Models\ProductionUpload;
use App\Models\ProductionUploadLine;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TimesheetVsDpcReportController extends Controller
{
    /**
     * Top-level company parents — primary projects sit directly under one of these.
     * Mirrors LocationController::index().
     */
    private const COMPANY_PARENT_IDS = ['1149031', '1198645', '1249093'];

    /**
     * Worktype eh_external_id prefixes that count as productive labour at the parent
     * (project-level) location. Everything else (annual leave, RDO, public holiday,
     * site admin, etc.) is excluded from the timesheet aggregate.
     */
    private const PARENT_PRODUCTIVE_WORKTYPE_PREFIXES = ['01-01', '03-01', '05-01', '07-01'];

    public function index()
    {
        return Inertia::render('reports/timesheet-vs-dpc', [
            'availableLocations' => $this->getAvailableLocations(),
        ]);
    }

    public function getData(Request $request)
    {
        $filters = $request->validate([
            'location_id' => 'required|integer|exists:locations,id',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
            'production_upload_id' => 'nullable|integer|exists:production_uploads,id',
        ]);

        /** @var Location $location */
        $location = Location::findOrFail($filters['location_id']);

        $user = auth()->user();
        if (! $user->can('locations.view-all') && ! $user->managedLocationIds()->contains($location->id)) {
            return response()->json([
                'success' => false,
                'message' => 'You do not have access to this project.',
            ], 403);
        }

        // List of DPC uploads available for this location (newest first)
        $uploads = $location->productionUploads()
            ->orderByDesc('report_date')
            ->orderByDesc('created_at')
            ->get(['id', 'report_date', 'original_filename'])
            ->map(fn ($u) => [
                'id' => $u->id,
                'report_date' => optional($u->report_date)->format('Y-m-d'),
                'label' => optional($u->report_date)->format('d M Y').' — '.$u->original_filename,
            ]);

        // Resolve which upload to use
        $upload = null;
        if (! empty($filters['production_upload_id'])) {
            $upload = ProductionUpload::where('id', $filters['production_upload_id'])
                ->where('location_id', $location->id)
                ->first();
        }
        if (! $upload) {
            $upload = $location->productionUploads()
                ->orderByDesc('report_date')
                ->orderByDesc('created_at')
                ->first();
        }

        if (! $upload) {
            return response()->json([
                'success' => true,
                'uploads' => $uploads,
                'selected_upload' => null,
                'rows' => [],
                'unmatched_sublocations' => [],
                'totals' => [
                    'timesheet_hours' => 0,
                    'dpc_hours' => 0,
                    'variance' => 0,
                    'variance_pct' => null,
                ],
                'message' => 'No DPC uploads found for this project.',
            ]);
        }

        // 1. Aggregate DPC lines by area + cost_code (in case multiple lines per code)
        $dpcLines = ProductionUploadLine::where('production_upload_id', $upload->id)
            ->where('cost_code', '!=', '')
            ->select('area', 'cost_code')
            ->selectRaw('MIN(code_description) as code_description')
            ->selectRaw('SUM(used_hours) as used_hours')
            ->selectRaw('SUM(est_hours) as est_hours')
            ->groupBy('area', 'cost_code')
            ->orderBy('area')
            ->orderBy('cost_code')
            ->get();

        // 2. Build map: dpc_key (suffix after ::) -> [eh_location_id, ...]
        // Sub-location external_id format: "<job>::<area>-<cost_code>"
        $subLocations = Location::where('eh_parent_id', $location->eh_location_id)
            ->whereNotNull('external_id')
            ->where('external_id', '!=', '')
            ->get(['id', 'name', 'eh_location_id', 'external_id']);

        $dpcKeyToSub = []; // dpc_key => [ ['eh_location_id' => ..., 'name' => ...], ... ]
        $subBySuffix = []; // suffix => sub-location row
        foreach ($subLocations as $sub) {
            if (! str_contains((string) $sub->external_id, '::')) {
                continue;
            }
            $suffix = trim((string) last(explode('::', $sub->external_id)));
            if ($suffix === '') {
                continue;
            }
            $dpcKeyToSub[$suffix][] = [
                'eh_location_id' => $sub->eh_location_id,
                'name' => $sub->name,
            ];
            $subBySuffix[$suffix] = $sub;
        }

        // 3. For each DPC line, find matching sub-location(s) and sum processed clock hours
        $dateFrom = $filters['date_from'] ?? null;
        $dateTo = $filters['date_to'] ?? null;

        $rows = [];
        $allocatedHours = 0.0; // timesheet hours from sub-locations matched to a DPC code
        $totalDpc = 0.0;
        $matchedSuffixes = [];

        foreach ($dpcLines as $line) {
            $dpcKey = $line->area.'-'.$line->cost_code;
            $matches = $dpcKeyToSub[$dpcKey] ?? [];
            $matchedEhIds = array_column($matches, 'eh_location_id');
            if (! empty($matchedEhIds)) {
                $matchedSuffixes[$dpcKey] = true;
            }

            $timesheetHours = 0.0;
            if (! empty($matchedEhIds)) {
                $timesheetHours = (float) $this->sumProcessedHours($matchedEhIds, $dateFrom, $dateTo);
            }

            $dpcHours = round((float) $line->used_hours, 2);
            $variance = round($timesheetHours - $dpcHours, 2);

            $rows[] = [
                'dpc_key' => $dpcKey,
                'area' => $line->area,
                'cost_code' => $line->cost_code,
                'description' => $line->code_description,
                'matched' => ! empty($matchedEhIds),
                'matched_sub_locations' => $matches,
                'timesheet_hours' => round($timesheetHours, 2),
                'dpc_hours' => $dpcHours,
                'est_hours' => round((float) $line->est_hours, 2),
                'variance' => $variance,
                'variance_pct' => $dpcHours > 0 ? round(($variance / $dpcHours) * 100, 1) : null,
            ];

            $allocatedHours += $timesheetHours;
            $totalDpc += $dpcHours;
        }

        // 4. Sub-locations whose suffix isn't a DPC key — surface as unmatched (with their hours)
        $unmatched = [];
        $unmatchedSubHours = 0.0;
        foreach ($subBySuffix as $suffix => $sub) {
            if (isset($matchedSuffixes[$suffix])) {
                continue;
            }
            // Check if a DPC row already exists for this suffix (it would be marked matched=true above);
            // if not, it's a sub-location with no corresponding DPC line.
            $hasDpcLine = $dpcLines->contains(fn ($l) => $l->area.'-'.$l->cost_code === $suffix);
            if ($hasDpcLine) {
                continue;
            }
            $hours = (float) $this->sumProcessedHours([$sub->eh_location_id], $dateFrom, $dateTo);
            $unmatched[] = [
                'sub_location_id' => $sub->id,
                'sub_location_name' => $sub->name,
                'external_id' => $sub->external_id,
                'suffix' => $suffix,
                'timesheet_hours' => round($hours, 2),
            ];
            $unmatchedSubHours += $hours;
        }

        // 5. Hours clocked directly to the parent location (i.e. not to any sub-location).
        // Workers may book leave / RDO / admin time at the parent — only count productive
        // worktypes (Wages, Foreman, Leading Hands, Labourers — eh_external_id prefixes
        // 01-01, 03-01, 05-01, 07-01). These hours don't map to a DPC code.
        $parentHours = $this->sumParentProductiveHours($location->eh_location_id, $dateFrom, $dateTo);

        // Unallocated = unmatched sub-location hours + parent productive hours.
        // These are real timesheet hours that can't be tied to a specific DPC code.
        $unallocatedHours = $unmatchedSubHours + $parentHours;
        $totalTimesheet = $allocatedHours + $unallocatedHours;
        $totalVariance = round($totalTimesheet - $totalDpc, 2);
        $allocatedVariance = round($allocatedHours - $totalDpc, 2);

        return response()->json([
            'success' => true,
            'uploads' => $uploads,
            'selected_upload' => [
                'id' => $upload->id,
                'report_date' => optional($upload->report_date)->format('Y-m-d'),
                'report_date_formatted' => optional($upload->report_date)->format('d M Y'),
                'original_filename' => $upload->original_filename,
            ],
            'rows' => $rows,
            'unmatched_sublocations' => $unmatched,
            'parent_hours' => round($parentHours, 2),
            'totals' => [
                'allocated_hours' => round($allocatedHours, 2),
                'unmatched_sub_hours' => round($unmatchedSubHours, 2),
                'parent_hours' => round($parentHours, 2),
                'unallocated_hours' => round($unallocatedHours, 2),
                'timesheet_hours' => round($totalTimesheet, 2),
                'dpc_hours' => round($totalDpc, 2),
                'allocated_variance' => $allocatedVariance,
                'allocated_variance_pct' => $totalDpc > 0 ? round(($allocatedVariance / $totalDpc) * 100, 1) : null,
                'variance' => $totalVariance,
                'variance_pct' => $totalDpc > 0 ? round(($totalVariance / $totalDpc) * 100, 1) : null,
            ],
        ]);
    }

    /**
     * Sum productive hours clocked directly to the parent (project-level) location.
     * Filters by Worktype.eh_external_id prefix (01-01, 03-01, 05-01, 07-01) so that
     * leave / RDO / admin worktypes don't inflate the timesheet total.
     */
    private function sumParentProductiveHours(string $parentEhLocationId, ?string $dateFrom, ?string $dateTo): float
    {
        $query = Clock::join('worktypes', 'clocks.eh_worktype_id', '=', 'worktypes.eh_worktype_id')
            ->where('clocks.eh_location_id', $parentEhLocationId)
            ->where('clocks.status', 'processed')
            ->whereNotNull('clocks.clock_out')
            ->where(function ($q) {
                foreach (self::PARENT_PRODUCTIVE_WORKTYPE_PREFIXES as $prefix) {
                    $q->orWhere('worktypes.eh_external_id', 'LIKE', $prefix.'%');
                }
            });

        if ($dateFrom) {
            $query->whereDate('clocks.clock_out', '>=', $dateFrom);
        }
        if ($dateTo) {
            $query->whereDate('clocks.clock_out', '<=', $dateTo);
        }

        return (float) $query->sum('clocks.hours_worked');
    }

    /**
     * Sum hours_worked from processed clocks for the given eh_location_ids and date range.
     */
    private function sumProcessedHours(array $ehLocationIds, ?string $dateFrom, ?string $dateTo): float
    {
        if (empty($ehLocationIds)) {
            return 0.0;
        }

        $query = Clock::whereIn('eh_location_id', $ehLocationIds)
            ->where('status', 'processed')
            ->whereNotNull('clock_out');

        if ($dateFrom) {
            $query->whereDate('clock_out', '>=', $dateFrom);
        }
        if ($dateTo) {
            $query->whereDate('clock_out', '<=', $dateTo);
        }

        return (float) $query->sum('hours_worked');
    }

    /**
     * Get available locations for the location selector, scoped by user role.
     */
    private function getAvailableLocations()
    {
        $user = auth()->user();

        $query = Location::open()
            ->whereNotNull('eh_location_id')
            ->where('eh_location_id', '!=', '')
            // Only primary projects: those whose parent is a company-level parent
            ->whereIn('eh_parent_id', self::COMPANY_PARENT_IDS);

        if (! $user->can('locations.view-all')) {
            $query->whereIn('id', $user->managedLocationIds());
        }

        return $query->orderBy('name')
            ->get(['id', 'name', 'eh_location_id', 'external_id'])
            ->map(fn ($l) => [
                'id' => $l->id,
                'name' => $l->name,
                'external_id' => $l->external_id,
            ]);
    }
}
