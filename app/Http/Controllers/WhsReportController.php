<?php

namespace App\Http\Controllers;

use App\Models\Clock;
use App\Models\Injury;
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

        return Inertia::render('reports/whs-report-edit', [
            'report' => $report,
            'previousReport' => $previousReport,
            'year' => $year,
            'month' => $month,
            'users' => \App\Models\User::orderBy('name')->get(['id', 'name']),
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
            'csq_payments' => 'nullable|array',
            'csq_payments.*.reference' => 'nullable|string',
            'csq_payments.*.date' => 'nullable|string',
            'csq_payments.*.description' => 'nullable|string',
            'csq_payments.*.total' => 'nullable|numeric',
            'training_summary' => 'nullable|string',
            'bottom_action_points' => 'nullable|array',
            'bottom_action_points.*.action' => 'required|string',
            'bottom_action_points.*.by_who' => 'nullable|string',
            'bottom_action_points.*.by_when' => 'nullable|string',
            'claims_overview' => 'nullable|array',
        ]);

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
        $monthlyInjuries = Injury::with('location.projectGroup')->forMonth($year, $month)->get();
        $monthlyRows = $this->aggregateByProject($monthlyInjuries);
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

        // Claims summary (active claims from injuries)
        $claims = Injury::with(['employee', 'location.projectGroup'])
            ->where('work_cover_claim', true)
            ->forFinancialYear($fyStartYear)
            ->get();

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
            'claims' => $claims,
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
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
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
}
