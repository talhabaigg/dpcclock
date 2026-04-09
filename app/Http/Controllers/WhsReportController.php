<?php

namespace App\Http\Controllers;

use App\Models\Clock;
use App\Models\GlTransactionDetail;
use App\Models\Injury;
use App\Models\JobCostDetail;
use App\Models\Location;
use App\Models\WhsReport;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Spatie\Browsershot\Browsershot;

class WhsReportController extends Controller
{
    public function edit(Request $request)
    {
        $request->validate([
            'year' => 'required|integer|min:2000|max:2100',
            'month' => 'required|integer|min:1|max:12',
        ]);

        $year = (int) $request->year;
        $month = (int) $request->month;

        $report = WhsReport::firstOrCreate(
            ['year' => $year, 'month' => $month],
            ['created_by' => auth()->id()]
        );

        // Get previous month's report for "copy from" feature
        $prevMonth = $month === 1 ? 12 : $month - 1;
        $prevYear = $month === 1 ? $year - 1 : $year;
        $previousReport = WhsReport::where('year', $prevYear)->where('month', $prevMonth)->first();

        // Claims overview from injuries for FY start to end of selected month
        $fyStartYear = $month >= 7 ? $year : $year - 1;
        $fyStart = "{$fyStartYear}-07-01";
        $monthEnd = date('Y-m-t', mktime(0, 0, 0, $month, 1, $year));
        $claimsInjuries = Injury::with('location.parentLocation.parentLocation')
            ->where('work_cover_claim', true)
            ->whereBetween('occurred_at', [$fyStart, $monthEnd])
            ->get();

        $claimsOverview = $claimsInjuries->groupBy(function ($injury) {
            $location = $injury->location;
            if (! $location) {
                return 'Others';
            }
            return $location->parentLocation?->parentLocation?->name ?? $location->parentLocation?->name ?? $location->name;
        })->map(function ($injuries, $entity) {
            return [
                'entity' => $entity,
                'total_lodged' => $injuries->count(),
                'active_statutory' => $injuries->where('claim_type', 'statutory')->where('claim_status', 'active')->count(),
                'active_common_law' => $injuries->where('claim_type', 'common_law')->where('claim_status', 'active')->count(),
                'denied' => $injuries->where('claim_status', 'denied')->count(),
            ];
        })->values()->all();

        // Training job cost for the month (location eh_id 1249164 = TRAINING)
        $trainingCost = (float) JobCostDetail::where('job_number', 'TRAINING')
            ->whereYear('transaction_date', $year)
            ->whereMonth('transaction_date', $month)
            ->sum('amount');

        // CSQ payments from GL transactions (income account 7002 = Misc. Income)
        $csqGlPayments = GlTransactionDetail::where('account', '7002')
            ->where('description', 'like', '%CSQ%')
            ->whereYear('transaction_date', $year)
            ->whereMonth('transaction_date', $month)
            ->orderBy('transaction_date')
            ->get()
            ->map(fn ($gl) => [
                'reference' => $gl->reference_document_number ?? '',
                'date' => $gl->transaction_date?->format('d/m/Y') ?? '',
                'description' => $gl->description ?? '',
                'total' => round((float) $gl->credit, 2),
            ])
            ->values()
            ->all();

        return Inertia::render('reports/whs-report-edit', [
            'report' => $report,
            'previousReport' => $previousReport,
            'year' => $year,
            'month' => $month,
            'users' => \App\Models\User::orderBy('name')->get(['id', 'name']),
            'claimsOverview' => $claimsOverview,
            'fyStartYear' => $fyStartYear,
            'trainingCost' => round($trainingCost, 2),
            'csqGlPayments' => $csqGlPayments,
        ]);
    }

    public function update(Request $request, WhsReport $whsReport)
    {
        $validated = $request->validate([
            'key_issues' => 'nullable|string',
            'action_points' => 'nullable|array',
            'action_points.*.action' => 'required|string',
            'action_points.*.by_who' => 'nullable|string',
            'action_points.*.by_when' => 'nullable|string',
            'apprentices' => 'nullable|array',
            'apprentices.*.name' => 'required|string',
            'apprentices.*.project' => 'nullable|string',
            'apprentices.*.year_level' => 'nullable|string',
            'apprentices.*.completion_date' => 'nullable|string',
            'apprentices.*.comments' => 'nullable|string',
            'training_summary' => 'nullable|string',
            'bottom_action_points' => 'nullable|array',
            'bottom_action_points.*.action' => 'required|string',
            'bottom_action_points.*.by_who' => 'nullable|string',
            'bottom_action_points.*.by_when' => 'nullable|string',
        ]);

        $allowedTags = '<p><br><strong><em><u><h2><h3><ul><ol><li>';
        if (!empty($validated['key_issues'])) {
            $validated['key_issues'] = strip_tags($validated['key_issues'], $allowedTags);
        }
        if (!empty($validated['training_summary'])) {
            $validated['training_summary'] = strip_tags($validated['training_summary'], $allowedTags);
        }

        $validated['updated_by'] = auth()->id();
        $whsReport->update($validated);

        return back()->with('success', 'Report saved.');
    }

    public function downloadPdf(Request $request)
    {
        $request->validate([
            'year' => 'required|integer|min:2000|max:2100',
            'month' => 'required|integer|min:1|max:12',
        ]);

        $year = (int) $request->year;
        $month = (int) $request->month;

        $report = WhsReport::where('year', $year)->where('month', $month)->first();

        // --- Auto-generated data ---

        // Monthly overview
        $monthlyInjuries = Injury::with(['location.projectGroup', 'employee'])->forMonth($year, $month)->get();
        $monthlyRows = $this->aggregateByProject($monthlyInjuries);

        // Work cover days: sum ALL workcover timesheets for the month, mapped to projects
        $workcoverWorktypeId = \App\Models\Worktype::where('name', 'Workcover')->value('eh_worktype_id');
        if ($workcoverWorktypeId) {
            // Get workcover hours grouped by eh_location_id
            $wcHoursByLocation = Clock::where('eh_worktype_id', $workcoverWorktypeId)
                ->whereYear('clock_in', $year)
                ->whereMonth('clock_in', $month)
                ->whereNotNull('clock_out')
                ->select('eh_location_id', DB::raw('SUM(hours_worked) as total_hours'))
                ->groupBy('eh_location_id')
                ->pluck('total_hours', 'eh_location_id');

            if ($wcHoursByLocation->isNotEmpty()) {
                // Build eh_location_id -> project name map using location hierarchy
                $ehLocationToProject = $this->buildLocationToProjectMap($wcHoursByLocation->keys()->all());

                // Reset total_days_lost for all rows
                foreach ($monthlyRows as &$mRow) {
                    $mRow['total_days_lost'] = 0;
                }
                unset($mRow);

                // Aggregate hours by project
                $daysByProject = [];
                foreach ($wcHoursByLocation as $ehLocId => $hours) {
                    $project = $ehLocationToProject[$ehLocId] ?? 'Others';
                    $daysByProject[$project] = ($daysByProject[$project] ?? 0) + round((float) $hours / 8, 1);
                }

                foreach ($daysByProject as $project => $days) {
                    $found = false;
                    foreach ($monthlyRows as &$mRow) {
                        if ($mRow['project'] === $project) {
                            $mRow['total_days_lost'] = $days;
                            $found = true;
                            break;
                        }
                    }
                    unset($mRow);

                    if (! $found && $days > 0) {
                        $monthlyRows[] = [
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

        // Suitable duties days: find injuries whose suitable duties period overlaps this month
        $monthStart = \Carbon\Carbon::create($year, $month, 1)->startOfDay();
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
            // Get excluded dates (public holidays + RDOs) for this month
            $excludedDates = \App\Models\TimesheetEvent::whereIn('type', ['public_holiday', 'rdo'])
                ->where('start', '<=', $monthEnd->toDateString())
                ->where('end', '>=', $monthStart->toDateString())
                ->get()
                ->flatMap(function ($event) use ($monthStart, $monthEnd) {
                    $dates = [];
                    $s = \Carbon\Carbon::parse($event->start)->max($monthStart);
                    $e = \Carbon\Carbon::parse($event->end)->min($monthEnd);
                    for ($d = $s->copy(); $d->lte($e); $d->addDay()) {
                        $dates[] = $d->toDateString();
                    }
                    return $dates;
                })
                ->unique()
                ->toArray();

            // Reset suitable duties for all rows
            foreach ($monthlyRows as &$mRow) {
                $mRow['days_suitable_duties'] = 0;
            }
            unset($mRow);

            foreach ($suitableDutiesInjuries as $injury) {
                $today = \Carbon\Carbon::today();
                $effectiveEnd = $monthEnd->gt($today) ? $today : $monthEnd;
                $from = \Carbon\Carbon::parse($injury->suitable_duties_from)->max($monthStart);
                $to = $injury->suitable_duties_to
                    ? \Carbon\Carbon::parse($injury->suitable_duties_to)->min($effectiveEnd)
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
                    foreach ($monthlyRows as &$mRow) {
                        if ($mRow['project'] === $project) {
                            $mRow['days_suitable_duties'] += $days;
                            $found = true;
                            break;
                        }
                    }
                    unset($mRow);

                    if (! $found) {
                        $monthlyRows[] = [
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

        $monthlyTotals = $this->computeTotals($monthlyRows);

        // FY performance
        $fyStartYear = $month >= 7 ? $year : $year - 1;
        $fyEndYear = $fyStartYear + 1;
        $fyLabel = "FY{$fyStartYear}/{$fyEndYear}";

        $fyInjuries = Injury::with('location.projectGroup')->forFinancialYear($fyStartYear)->get();
        $fyRows = $this->aggregateByProject($fyInjuries);

        $manHours = $this->getManHoursByProject($fyStartYear, $fyEndYear);
        foreach ($fyRows as &$row) {
            $hours = (float) ($manHours[$row['location_id']] ?? 0);
            $row['man_hours'] = round($hours, 0);
            $row['ltifr'] = $row['man_hours'] > 0
                ? round(($row['lti_count'] / $row['man_hours']) * 1_000_000, 2)
                : null;
        }

        $fyTotals = $this->computeTotals($fyRows);
        $fyTotals['man_hours'] = array_sum(array_column($fyRows, 'man_hours'));
        $fyTotals['ltifr'] = $fyTotals['man_hours'] > 0
            ? round(($fyTotals['lti_count'] / $fyTotals['man_hours']) * 1_000_000, 2)
            : null;

        // Monthly injury chart data (all years, grouped by month)
        $chartData = $this->getMonthlyChartData();

        // Claims overview (FY start to end of selected month)
        $fyStart = "{$fyStartYear}-07-01";
        $monthEnd = date('Y-m-t', mktime(0, 0, 0, $month, 1, $year));
        $claimsInjuries = Injury::with('location.parentLocation.parentLocation')
            ->where('work_cover_claim', true)
            ->whereBetween('occurred_at', [$fyStart, $monthEnd])
            ->get();

        $claimsOverview = $claimsInjuries->groupBy(function ($injury) {
            $location = $injury->location;
            if (! $location) {
                return 'Others';
            }
            return $location->parentLocation?->parentLocation?->name ?? $location->parentLocation?->name ?? $location->name;
        })->map(function ($injuries, $entity) {
            return [
                'entity' => $entity,
                'total_lodged' => $injuries->count(),
                'active_statutory' => $injuries->where('claim_type', 'statutory')->where('claim_status', 'active')->count(),
                'active_common_law' => $injuries->where('claim_type', 'common_law')->where('claim_status', 'active')->count(),
                'denied' => $injuries->where('claim_status', 'denied')->count(),
            ];
        })->values()->all();

        // Claims summary (active claims from injuries)
        $claims = Injury::with(['employee', 'location.projectGroup', 'location.parentLocation.parentLocation'])
            ->where('work_cover_claim', true)
            ->forFinancialYear($fyStartYear)
            ->get();

        // CSQ payments from GL
        $csqGlPayments = GlTransactionDetail::where('account', '7002')
            ->where('description', 'like', '%CSQ%')
            ->whereYear('transaction_date', $year)
            ->whereMonth('transaction_date', $month)
            ->orderBy('transaction_date')
            ->get()
            ->map(fn ($gl) => [
                'reference' => $gl->reference_document_number ?? '',
                'date' => $gl->transaction_date?->format('d/m/Y') ?? '',
                'description' => $gl->description ?? '',
                'total' => round((float) $gl->credit, 2),
            ])
            ->values()
            ->all();

        // LTIFR comparison with previous years (keyed by FY end year, e.g. 2026 = FY 2025/2026)
        $historicalLtifr = [
            2021 => 9.93,
            2022 => 12.86,
            2023 => 12.84,
            2024 => 10.62,
            2025 => 60.07,
        ];
        $firstRealEndYear = 2026;
        $currentFyEndYear = $fyStartYear + 1;
        $ltifrComparison = $historicalLtifr;
        for ($endYr = $firstRealEndYear; $endYr <= $currentFyEndYear; $endYr++) {
            $startYr = $endYr - 1;
            $ltiCount = Injury::forFinancialYear($startYr)->where('report_type', 'lti')->count();
            $totalHours = (float) array_sum($this->getManHoursByProject($startYr, $endYr));
            $ltifrComparison[$endYr] = $totalHours > 0 ? round(($ltiCount / $totalHours) * 1_000_000, 2) : 0;
        }

        // Training cost for the month
        $trainingCost = round((float) JobCostDetail::where('job_number', 'TRAINING')
            ->whereYear('transaction_date', $year)
            ->whereMonth('transaction_date', $month)
            ->sum('amount'), 2);

        $monthLabel = date('F', mktime(0, 0, 0, $month, 1));
        $reportId = 'WHS-R-' . str_pad($month, 2, '0', STR_PAD_LEFT) . '-' . substr($year, 2);

        // Logo
        $logoPath = public_path('logo.png');
        if (! file_exists($logoPath)) {
            $logoPath = public_path('SWCPE_Logo.PNG');
        }
        $logoBase64 = file_exists($logoPath)
            ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath))
            : '';

        $html = view('whs-report.pdf', [
            'report' => $report,
            'monthLabel' => $monthLabel,
            'year' => $year,
            'month' => $month,
            'reportId' => $reportId,
            'fyLabel' => $fyLabel,
            'monthlyRows' => $monthlyRows,
            'monthlyTotals' => $monthlyTotals,
            'fyRows' => $fyRows,
            'fyTotals' => $fyTotals,
            'chartData' => $chartData,
            'claimsOverview' => $claimsOverview,
            'claims' => $claims,
            'csqGlPayments' => $csqGlPayments,
            'trainingCost' => $trainingCost,
            'ltifrComparison' => $ltifrComparison,
            'fyStartYear' => $fyStartYear,
            'currentFyEndYear' => $currentFyEndYear,
            'firstRealEndYear' => $firstRealEndYear,
            'logoBase64' => $logoBase64,
        ])->render();

        $headerHtml = <<<HEADER
        <div style="width: 100%; padding: 8px 15mm 6px;">
            <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 6px; border-bottom: 2px solid #0077B6;">
                <div>
                    <img src="{$logoBase64}" style="max-height: 40px;" />
                </div>
                <div style="text-align: right; font-family: Arial, Helvetica, sans-serif;">
                    <div style="font-size: 10px; color: #333;">WHS MONTHLY REPORT: {$monthLabel} {$year}</div>
                    <div style="font-size: 9px; color: #666;">{$reportId}</div>
                </div>
            </div>
        </div>
        HEADER;

        $footerHtml = <<<FOOTER
        <div style="width: 100%; padding: 0 15mm 6px;">
            <div style="display: flex; align-items: center; font-family: Arial, Helvetica, sans-serif; font-size: 8px; color: #6b7280; padding-top: 4px; border-top: 1px solid #ccc;">
                <div style="flex: 1; text-transform: uppercase; letter-spacing: 0.5px;">Superior Wall &amp; Ceiling Professionals Pty Ltd</div>
                <div style="flex: 1; text-align: right;">Page <span class="pageNumber"></span></div>
            </div>
        </div>
        FOOTER;

        $browsershot = Browsershot::html($html);

        if ($nodeBinary = env('BROWSERSHOT_NODE_BINARY')) {
            $browsershot->setNodeBinary($nodeBinary);
        }
        if ($npmBinary = env('BROWSERSHOT_NPM_BINARY')) {
            $browsershot->setNpmBinary($npmBinary);
        }
        if ($chromePath = env('BROWSERSHOT_CHROME_PATH')) {
            $browsershot->setChromePath($chromePath);
        }

        $pdfContent = $browsershot
            ->noSandbox()
            ->landscape()
            ->format('A4')
            ->margins(22, 15, 16, 15, 'mm')
            ->showBackground()
            ->showBrowserHeaderAndFooter()
            ->headerHtml($headerHtml)
            ->footerHtml($footerHtml)
            ->pdf();

        $filename = str_pad($month, 2, '0', STR_PAD_LEFT) . "_SWCP WHS Report [{$monthLabel}_{$year}].pdf";

        return response($pdfContent, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
        ]);
    }

    // --- Reuse aggregation logic from SafetyDashboardController ---

    private function aggregateByProject($injuries): array
    {
        $grouped = $injuries->groupBy(function ($injury) {
            $location = $injury->location;
            if (! $location) {
                return 'Others';
            }
            if ($location->project_group_id) {
                return $location->projectGroup?->name ?? $location->name;
            }
            return $location->name;
        });

        $rows = [];
        foreach ($grouped as $project => $records) {
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

    private function getManHoursByProject(int $fyStartYear, int $fyEndYear): array
    {
        $jobsEhIds = Location::where('name', 'Jobs')->pluck('eh_location_id');
        $projects = Location::whereIn('eh_parent_id', $jobsEhIds)
            ->get(['id', 'name', 'eh_location_id', 'project_group_id']);

        $allLocations = Location::whereNotNull('eh_location_id')
            ->get(['id', 'eh_location_id', 'eh_parent_id']);
        $childrenMap = [];
        foreach ($allLocations as $loc) {
            if ($loc->eh_parent_id) {
                $childrenMap[$loc->eh_parent_id][] = $loc->eh_location_id;
            }
        }

        $projectDescendants = [];
        foreach ($projects as $project) {
            if ($project->project_group_id) {
                continue;
            }
            $descendants = [$project->eh_location_id];
            $queue = [$project->eh_location_id];
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

    private function getMonthlyChartData(): array
    {
        $data = Injury::selectRaw('YEAR(occurred_at) as yr, MONTH(occurred_at) as mo, COUNT(*) as cnt')
            ->whereNotNull('occurred_at')
            ->groupByRaw('YEAR(occurred_at), MONTH(occurred_at)')
            ->orderByRaw('YEAR(occurred_at), MONTH(occurred_at)')
            ->get();

        $result = [];
        foreach ($data as $row) {
            $result[$row->yr][$row->mo] = $row->cnt;
        }

        return $result;
    }

    /**
     * Map eh_location_ids to project names by walking up the location hierarchy.
     */
    private function buildLocationToProjectMap(array $ehLocationIds): array
    {
        // Get "Jobs" container IDs
        $jobsEhIds = Location::where('name', 'Jobs')->pluck('eh_location_id')->all();

        // Get all projects (direct children of Jobs)
        $projects = Location::whereIn('eh_parent_id', $jobsEhIds)
            ->get(['id', 'name', 'eh_location_id', 'eh_parent_id', 'project_group_id']);

        // Build parent->children map for traversal
        $allLocations = Location::whereNotNull('eh_location_id')
            ->get(['id', 'name', 'eh_location_id', 'eh_parent_id', 'project_group_id']);
        $locationByEhId = $allLocations->keyBy('eh_location_id');

        // For each target eh_location_id, walk up to find its project ancestor
        $map = [];
        foreach ($ehLocationIds as $ehId) {
            $current = $ehId;
            $projectName = 'Others';
            $visited = [];

            while ($current && ! in_array($current, $visited)) {
                $visited[] = $current;

                // Check if this is a project (direct child of Jobs)
                $loc = $locationByEhId[$current] ?? null;
                if ($loc && in_array($loc->eh_parent_id, $jobsEhIds)) {
                    // Found the project — use group name if grouped
                    if ($loc->project_group_id) {
                        $group = $projects->firstWhere('id', $loc->project_group_id);
                        $projectName = $group?->name ?? $loc->name;
                    } else {
                        $projectName = $loc->name;
                    }
                    break;
                }

                // Walk up
                $current = $loc?->eh_parent_id;
            }

            $map[$ehId] = $projectName;
        }

        return $map;
    }
}
