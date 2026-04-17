<?php

namespace App\Http\Controllers;

use App\Models\DashboardLayout;
use App\Models\JobCostDetail;
use App\Models\JobReportByCostItemAndCostType;
use App\Models\Location;
use App\Models\LocationItemPriceHistory;
use App\Models\ProductionUploadLine;
use App\Models\Variation;
use App\Models\Worktype;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class LocationController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $showClosed = $request->boolean('show_closed', false);

        // Fetch primary locations
        $query = Location::with('worktypes')
            ->where(function ($q) {
                $q->where('eh_parent_id', 1149031)
                  ->orWhere('eh_parent_id', 1198645)
                  ->orWhere('eh_parent_id', 1249093);
            });

        if (! $showClosed) {
            $query->open();
        }

        // Scope to managed locations for non-admin/office-admin users
        $user = auth()->user();
        if (! $user->can('locations.view-all')) {
            $query->whereIn('id', $user->managedLocationIds());
        }

        $locations = $query->get();

        // Fetch sub-locations for each primary location
        foreach ($locations as $location) {
            $location->subLocations = Location::where('eh_parent_id', $location->eh_location_id)->get();
        }

        return Inertia::render('locations/index', [
            'locations' => $locations,
            'showClosed' => $showClosed,
            'can' => [
                'closeProjects' => auth()->user()->can('locations.close'),
            ],
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Load base location data with tab counts (shared across all tab pages).
     */
    public function getLocationWithCounts(Location $location): Location
    {
        $location->load('worktypes');
        $location->subLocations = Location::where('eh_parent_id', $location->eh_location_id)->get();
        $location->tab_counts = [
            'sublocations' => $location->subLocations->count(),
            'cost_codes' => $location->costCodes()->count(),
            'price_list' => $location->materialItems()->count(),
            'favourites' => $location->favouriteMaterials()->count(),
            'production_data' => $location->productionUploads()->count(),
            'tasks' => $location->projectTasks()->count(),
        ];

        $user = auth()->user();
        $location->tab_permissions = [
            'cost_codes' => $user->can('locations.cost-codes'),
            'price_list' => $user->can('locations.price-list'),
            'favourites' => $user->can('locations.favourites'),
            'production_data' => $user->can('locations.production-data'),
            'schedule' => $user->can('locations.schedule'),
        ];

        return $location;
    }

    /**
     * Display the specified resource (sub-locations tab).
     */
    public function show(Location $location)
    {
        $user = auth()->user();
        if (! $user->can('locations.view-all') && ! $user->managedLocationIds()->contains($location->id)) {
            abort(403, 'You do not have access to this project.');
        }

        $this->getLocationWithCounts($location);

        // Get distinct area-cost_code combos from the latest DPC production upload
        // These map to the external_id suffix (part after ::) on sub-locations
        $latestUpload = $location->productionUploads()->orderByDesc('report_date')->first();
        $dpcKeys = [];
        if ($latestUpload) {
            $dpcKeys = ProductionUploadLine::where('production_upload_id', $latestUpload->id)
                ->select('area', 'cost_code')
                ->distinct()
                ->get()
                ->map(fn ($row) => $row->area.'-'.$row->cost_code)
                ->filter()
                ->values()
                ->all();
        }

        return Inertia::render('locations/show', [
            'location' => $location,
            'dpcKeys' => $dpcKeys,
        ]);
    }

    /**
     * Display the cost codes tab.
     */
    public function costCodes(Location $location)
    {
        $this->getLocationWithCounts($location);
        $location->load(['costCodes' => fn ($query) => $query->orderByRaw('CAST(code AS UNSIGNED)')]);

        return Inertia::render('locations/cost-codes', [
            'location' => $location,
        ]);
    }

    /**
     * Display the price list tab.
     */
    public function priceList(Location $location)
    {
        $this->getLocationWithCounts($location);
        $location->load('materialItems.supplier');

        // Load user names for material items updated_by
        $userIds = $location->materialItems->pluck('pivot.updated_by')->filter()->unique()->values();
        $users = \App\Models\User::whereIn('id', $userIds)->pluck('name', 'id');

        // Attach user names to material items
        $location->materialItems->each(function ($item) use ($users) {
            $item->pivot->updated_by_name = $item->pivot->updated_by ? ($users[$item->pivot->updated_by] ?? null) : null;
        });

        return Inertia::render('locations/price-list', [
            'location' => $location,
        ]);
    }

    /**
     * Display the favourite materials tab.
     */
    public function favourites(Location $location)
    {
        $this->getLocationWithCounts($location);
        $location->load('favouriteMaterials');

        return Inertia::render('locations/favourites', [
            'location' => $location,
        ]);
    }

    /**
     * Display the schedule / Gantt tab.
     */
    public function schedule(Location $location)
    {
        $this->getLocationWithCounts($location);

        $tasks = $location->projectTasks()
            ->orderBy('sort_order')
            ->get();

        $links = \App\Models\ProjectTaskLink::where('location_id', $location->id)->get();

        // Non-work days pulled from timesheet_events scoped to this location's state,
        // unioned with this project's own non-work days (safety/weather/industrial_action/other).
        // Each row expands to one entry per calendar day between start and end inclusive.
        $state = $location->state ?? 'QLD';
        $nonWorkDays = [];

        $events = \App\Models\TimesheetEvent::where('state', $state)
            ->whereIn('type', ['public_holiday', 'rdo'])
            ->get(['title', 'start', 'end', 'type']);
        foreach ($events as $e) {
            $cursor = \Illuminate\Support\Carbon::parse($e->start);
            $end = \Illuminate\Support\Carbon::parse($e->end);
            while ($cursor->lte($end)) {
                $nonWorkDays[] = [
                    'date' => $cursor->format('Y-m-d'),
                    'type' => $e->type, // 'public_holiday' | 'rdo'
                    'label' => $e->title,
                ];
                $cursor->addDay();
            }
        }

        $projectNwd = $location->nonWorkDays()->get(['title', 'start', 'end', 'type']);
        foreach ($projectNwd as $e) {
            $cursor = \Illuminate\Support\Carbon::parse($e->start);
            $end = \Illuminate\Support\Carbon::parse($e->end);
            while ($cursor->lte($end)) {
                $nonWorkDays[] = [
                    'date' => $cursor->format('Y-m-d'),
                    'type' => 'project', // distinct from global types so gantt can color-code
                    'subtype' => $e->type, // safety | industrial_action | weather | other
                    'label' => $e->title,
                ];
                $cursor->addDay();
            }
        }

        // Active labour pay rate templates for the Resource picker on tasks.
        $payRateTemplates = $location->labourForecastTemplates()
            ->with('payRateTemplate:id,name')
            ->get(['id', 'location_id', 'pay_rate_template_id', 'custom_label', 'hourly_rate', 'sort_order'])
            ->map(fn ($t) => [
                'id' => $t->id,
                'label' => $t->custom_label ?: ($t->payRateTemplate?->name ?? 'Template #' . $t->id),
                'hourly_rate' => (float) $t->hourly_rate,
                'sort_order' => $t->sort_order,
            ])
            ->values();

        return Inertia::render('locations/schedule', [
            'location' => $location,
            'tasks' => $tasks,
            'links' => $links,
            'nonWorkDays' => $nonWorkDays,
            'workingDays' => $location->working_days_resolved,
            'payRateTemplates' => $payRateTemplates,
        ]);
    }

    /**
     * Project dashboard landing page — select a job to view its dashboard.
     */
    public function projectDashboard()
    {
        $availableLocations = $this->getAvailableLocations();

        return Inertia::render('locations/project-dashboard', [
            'availableLocations' => $availableLocations,
        ]);
    }

    /**
     * Get available locations for the job selector, scoped by user role.
     * Admin/office-admin see all; managers only see their kiosk-assigned locations.
     */
    private function getAvailableLocations()
    {
        $user = auth()->user();

        $query = Location::open()
            ->with('jobSummary')
            ->whereHas('jobSummary')
            ->whereNotNull('external_id')
            ->where('external_id', '!=', '');

        if (! $user->can('locations.view-all')) {
            $query->whereIn('id', $user->managedLocationIds());
        }

        return $query->orderBy('name')
            ->get()
            ->map(fn($loc) => [
                'id' => $loc->id,
                'name' => $loc->name,
                'external_id' => $loc->external_id,
            ]);
    }

    /**
     * Display the project dashboard.
     */
    public function dashboard(Request $request, Location $location)
    {
        // Ensure non-admin/office-admin users can only access their managed locations
        $user = auth()->user();
        if (! $user->can('locations.view-all') && ! $user->managedLocationIds()->contains($location->id)) {
            abort(403, 'You do not have access to this project.');
        }

        $location->load('jobSummary', 'vendorCommitments');

        // Append forecast cost from job report (sum of estimate_at_completion)
        if ($location->jobSummary && $location->external_id) {
            $forecastCost = DB::table('job_report_by_cost_items_and_cost_types')
                ->where('job_number', $location->external_id)
                ->sum('estimate_at_completion');
            $location->jobSummary->setAttribute('forecast_cost', (float) $forecastCost);
        }

        // Get the "as of" date from query params, default to today
        $asOfDate = $request->input('as_of_date')
            ? \Carbon\Carbon::parse($request->input('as_of_date'))
            : \Carbon\Carbon::now();

        // Get project timeline data
        $timelineData = $this->getTimelineData($location);

        // Calculate financial metrics as of the selected date
        $claimedToDate = $this->calculateClaimedToDate($location, $asOfDate);
        $cashRetention = $this->calculateCashRetention($location, $asOfDate);

        // Calculate project income data
        $projectIncomeCalculator = new \App\Services\ProjectIncomeCalculator();
        $projectIncomeData = $projectIncomeCalculator->calculate($location, $asOfDate);

        // Calculate variations summary grouped by status and type
        $variationsSummary = DB::table('variations')
            ->leftJoin('variation_line_items', 'variations.id', '=', 'variation_line_items.variation_id')
            ->where('variations.location_id', $location->id)
            ->whereNull('variations.deleted_at')
            ->select('variations.status', 'variations.type')
            ->selectRaw('COUNT(DISTINCT variations.id) as qty')
            ->selectRaw('COALESCE(SUM(variation_line_items.revenue), 0) as value')
            ->groupBy('variations.status', 'variations.type')
            ->get();

        $totalVariations = $variationsSummary->sum('qty');

        // Aging >30 days for 'PENDING' type variations
        $agingStats = DB::table('variations')
            ->leftJoin('variation_line_items', 'variations.id', '=', 'variation_line_items.variation_id')
            ->where('variations.location_id', $location->id)
            ->where('variations.type', 'PENDING')
            ->whereNull('variations.deleted_at')
            ->where('variations.co_date', '<=', now()->subDays(30))
            ->selectRaw('COUNT(DISTINCT variations.id) as count')
            ->selectRaw('COALESCE(SUM(variation_line_items.revenue), 0) as value')
            ->first();

        $variationsSummaryData = $variationsSummary->map(fn($row) => [
            'status' => $row->status ?? 'Unknown',
            'type' => $row->type ?? 'Unknown',
            'qty' => (int) $row->qty,
            'value' => round((float) $row->value, 2),
            'percent_of_total' => $totalVariations > 0
                ? round(($row->qty / $totalVariations) * 100, 1)
                : 0,
            'aging_over_30' => strtoupper($row->type) === 'PENDING' ? (int) $agingStats->count : null,
            'aging_over_30_value' => strtoupper($row->type) === 'PENDING' ? round((float) $agingStats->value, 2) : null,
        ])->values()->toArray();

        // Labour budget utilization by cost item
        $budgets = JobReportByCostItemAndCostType::where('job_number', $location->external_id)
            ->select('cost_item', DB::raw('SUM(current_estimate) as budget'))
            ->groupBy('cost_item')
            ->get()
            ->keyBy('cost_item');

        $actuals = JobCostDetail::where('job_number', $location->external_id)
            ->where('transaction_date', '<=', $asOfDate->format('Y-m-d'))
            ->select(
                'cost_item',
                DB::raw('MAX(cost_item_description) as label'),
                DB::raw('SUM(amount) as spent')
            )
            ->groupBy('cost_item')
            ->get()
            ->keyBy('cost_item');

        $labourBudgetData = $budgets->map(function ($budget) use ($actuals) {
            $actual = $actuals->get($budget->cost_item);
            $budgetAmt = round((float) $budget->budget, 0);
            $spentAmt = $actual ? round((float) $actual->spent, 0) : 0;

            return [
                'cost_item' => $budget->cost_item,
                'label' => $actual?->label ?: $budget->cost_item,
                'budget' => $budgetAmt,
                'spent' => $spentAmt,
                'percent' => $budgetAmt > 0 ? round(($spentAmt / $budgetAmt) * 100, 1) : 0,
            ];
        })->sortByDesc('budget')->values()->toArray();

        // Vendor commitments summary split by PO and SC
        $vendorCommitmentsSummary = null;

        if ($location->vendorCommitments->isNotEmpty()) {
            $commitments = $location->vendorCommitments;

            // SC = has subcontract_no
            $scCommitments = $commitments->filter(fn($c) => !empty($c->subcontract_no));

            // PO transaction lines = no subcontract_no
            $poCommitments = $commitments->filter(fn($c) => empty($c->subcontract_no));

            $vendorCommitmentsSummary = [
                'po_outstanding' => round((float) $poCommitments->sum('os_commitment'), 2),
                'po_lines' => $poCommitments->map(fn($c) => [
                    'vendor' => $c->vendor,
                    'po_no' => $c->po_no,
                    'approval_status' => $c->approval_status,
                    'original_commitment' => round((float) $c->original_commitment, 2),
                    'approved_changes' => round((float) $c->approved_changes, 2),
                    'current_commitment' => round((float) $c->current_commitment, 2),
                    'total_billed' => round((float) $c->total_billed, 2),
                    'os_commitment' => round((float) $c->os_commitment, 2),
                    'updated_at' => $c->updated_at?->toDateString(),
                ])->values()->toArray(),
                'sc_outstanding' => round((float) $scCommitments->sum('os_commitment'), 2),
                'sc_summary' => [
                    'value' => round((float) $scCommitments->sum('original_commitment'), 2),
                    'variations' => round((float) $scCommitments->sum('approved_changes'), 2),
                    'invoiced_to_date' => round((float) $scCommitments->sum('total_billed'), 2),
                    'remaining_balance' => round((float) $scCommitments->sum('os_commitment'), 2),
                ],
            ];
        }

        // Pending POs from OData AP Purchase Orders (scoped to as-of month)
        $pendingPos = null;
        if ($location->external_id) {
            $pendingPoLines = \App\Models\ApPurchaseOrder::where('job_number', $location->external_id)
                ->where('status', 'PENDING')
                ->whereYear('po_date', $asOfDate->year)
                ->whereMonth('po_date', $asOfDate->month)
                ->where('po_date', '<=', $asOfDate)
                ->get();

            if ($pendingPoLines->isNotEmpty()) {
                $pendingPos = [
                    'total' => round((float) $pendingPoLines->sum('amount'), 2),
                    'po_count' => $pendingPoLines->pluck('po_number')->unique()->count(),
                    'line_count' => $pendingPoLines->count(),
                ];
            }
        }

        // Employees on site - unique count by worktype + monthly trend
        $employeesOnSite = null;
        if ($location->eh_location_id) {
            $locationIds = Location::where('eh_parent_id', $location->eh_location_id)
                ->pluck('eh_location_id')
                ->push($location->eh_location_id)
                ->unique()
                ->values()
                ->toArray();

            // By employee's default worktype — scoped to selected month
            $monthStart = $asOfDate->copy()->startOfMonth();
            $monthEnd = $asOfDate->copy()->endOfMonth();

            $byType = DB::table('clocks')
                ->join('employees', 'clocks.eh_employee_id', '=', 'employees.eh_employee_id')
                ->leftJoin('employee_worktype', 'employees.id', '=', 'employee_worktype.employee_id')
                ->leftJoin('worktypes', 'employee_worktype.worktype_id', '=', 'worktypes.id')
                ->whereIn('clocks.eh_location_id', $locationIds)
                ->where('clocks.status', 'processed')
                ->whereNotNull('clocks.clock_out')
                ->whereBetween('clocks.clock_in', [$monthStart, $monthEnd])
                ->select(
                    DB::raw("COALESCE(worktypes.name, 'Unknown') as worktype"),
                    DB::raw('COUNT(DISTINCT clocks.eh_employee_id) as count')
                )
                ->groupBy('worktype')
                ->orderByDesc('count')
                ->get()
                ->map(fn($r) => ['worktype' => $r->worktype, 'count' => (int) $r->count])
                ->toArray();

            // Weekly trend (weeks ending Friday)
            $weeklyTrend = DB::table('clocks')
                ->whereIn('eh_location_id', $locationIds)
                ->where('status', 'processed')
                ->whereNotNull('clock_out')
                ->select(
                    DB::raw("DATE_FORMAT(DATE_ADD(clock_in, INTERVAL (4 - WEEKDAY(clock_in) + 7) % 7 DAY), '%Y-%m-%d') as week_ending"),
                    DB::raw('COUNT(DISTINCT eh_employee_id) as count')
                )
                ->groupBy('week_ending')
                ->orderBy('week_ending')
                ->get()
                ->map(fn($r) => [
                    'week_ending' => $r->week_ending,
                    'month' => substr($r->week_ending, 0, 7),
                    'count' => (int) $r->count,
                ])
                ->toArray();

            // Total unique workers in last 30 days
            $totalWorkers = (int) DB::table('clocks')
                ->whereIn('eh_location_id', $locationIds)
                ->where('status', 'processed')
                ->whereNotNull('clock_out')
                ->where('clock_in', '>=', now()->subDays(30))
                ->distinct('eh_employee_id')
                ->count('eh_employee_id');

            // Previous 30-day window (31-60 days ago) for delta
            $prevWorkers = (int) DB::table('clocks')
                ->whereIn('eh_location_id', $locationIds)
                ->where('status', 'processed')
                ->whereNotNull('clock_out')
                ->whereBetween('clock_in', [now()->subDays(60), now()->subDays(30)])
                ->distinct('eh_employee_id')
                ->count('eh_employee_id');

            // Casual workers in last 30 days
            $casualWorkers = (int) DB::table('clocks')
                ->join('employees', 'clocks.eh_employee_id', '=', 'employees.eh_employee_id')
                ->whereIn('clocks.eh_location_id', $locationIds)
                ->where('clocks.status', 'processed')
                ->whereNotNull('clocks.clock_out')
                ->where('clocks.clock_in', '>=', now()->subDays(30))
                ->where('employees.employment_type', 'Casual')
                ->distinct('clocks.eh_employee_id')
                ->count('clocks.eh_employee_id');

            $employeesOnSite = [
                'by_type' => $byType,
                'weekly_trend' => $weeklyTrend,
                'total_workers' => $totalWorkers,
                'prev_workers' => $prevWorkers,
                'casual_workers' => $casualWorkers,
            ];
        }

        // Get available locations for the selector (scoped by user role)
        $availableLocations = $this->getAvailableLocations();

        // Industrial action — total hours where worktype is industrial action (eh_worktype_id = 2585103)
        $industrialActionHours = 0;
        if ($location->eh_location_id) {
            $iaLocationIds = $employeesOnSite
                ? $locationIds  // reuse if already built
                : Location::where('eh_parent_id', $location->eh_location_id)
                    ->pluck('eh_location_id')
                    ->push($location->eh_location_id)
                    ->unique()
                    ->values()
                    ->toArray();

            $industrialActionHours = (float) DB::table('clocks')
                ->whereIn('eh_location_id', $iaLocationIds)
                ->where('eh_worktype_id', 2585103)
                ->where('status', 'processed')
                ->whereNotNull('clock_out')
                ->sum('hours_worked');
        }

        // Production data — available uploads + selected upload's cost codes & lines
        $productionUploads = $location->productionUploads()
            ->where('status', 'completed')
            ->orderByDesc('report_date')
            ->get(['id', 'report_date', 'original_filename', 'total_rows']);

        $selectedUploadId = $request->input('production_upload_id');
        $selectedUpload = $selectedUploadId
            ? $productionUploads->firstWhere('id', (int) $selectedUploadId)
            : $productionUploads->first();

        $productionCostCodes = [];
        $productionLines = [];
        $dpcPercentComplete = null;

        if ($selectedUpload) {
            $productionCostCodes = ProductionUploadLine::where('production_upload_id', $selectedUpload->id)
                ->select(
                    'cost_code',
                    DB::raw('MAX(code_description) as code_description'),
                    DB::raw('SUM(est_hours) as est_hours'),
                    DB::raw('SUM(used_hours) as used_hours'),
                    DB::raw('GREATEST(SUM(est_hours) - SUM(used_hours), 0) as remaining_hours'),
                    DB::raw('SUM(actual_variance) as actual_variance'),
                )
                ->where('cost_code', '!=', '')
                ->groupBy('cost_code')
                ->orderBy('cost_code')
                ->get()
                ->map(fn($row) => [
                    'cost_code' => $row->cost_code,
                    'code_description' => $row->code_description,
                    'est_hours' => round((float) $row->est_hours, 2),
                    'used_hours' => round((float) $row->used_hours, 2),
                    'remaining_hours' => round((float) $row->remaining_hours, 2),
                    'actual_variance' => round((float) $row->actual_variance, 2),
                ])
                ->values()
                ->toArray();

            $productionLines = $selectedUpload->lines()->get();

            // DPC overall % complete: weighted by est_hours
            $totals = ProductionUploadLine::where('production_upload_id', $selectedUpload->id)
                ->where('cost_code', '!=', '')
                ->select(
                    DB::raw('SUM(earned_hours) as total_earned'),
                    DB::raw('SUM(est_hours) as total_est'),
                )
                ->first();

            $dpcPercentComplete = $totals && $totals->total_est > 0
                ? round(((float) $totals->total_earned / (float) $totals->total_est) * 100, 2)
                : null;
        }

        // Variance trend across ALL uploads — grouped by report_date + area + cost_code
        $varianceTrend = [];
        if ($productionUploads->isNotEmpty()) {
            $varianceTrend = ProductionUploadLine::whereIn('production_upload_lines.production_upload_id', $productionUploads->pluck('id'))
                ->join('production_uploads', 'production_upload_lines.production_upload_id', '=', 'production_uploads.id')
                ->select(
                    'production_uploads.report_date',
                    'production_upload_lines.area',
                    'production_upload_lines.cost_code',
                    DB::raw('SUM(production_upload_lines.actual_variance) as actual_variance'),
                )
                ->groupBy('production_uploads.report_date', 'production_upload_lines.area', 'production_upload_lines.cost_code')
                ->orderBy('production_uploads.report_date')
                ->get()
                ->map(fn($row) => [
                    'report_date' => $row->report_date,
                    'area' => $row->area,
                    'cost_code' => $row->cost_code,
                    'actual_variance' => round((float) $row->actual_variance, 2),
                ])
                ->values()
                ->toArray();
        }

        // Payroll hours by worktype — sum clock hours grouped by worktype name
        $payrollHoursByWorktype = [];
        if ($location->eh_location_id) {
            $plLocationIds = isset($locationIds) ? $locationIds
                : Location::where('eh_parent_id', $location->eh_location_id)
                    ->pluck('eh_location_id')
                    ->push($location->eh_location_id)
                    ->unique()
                    ->values()
                    ->toArray();

            $payrollHoursByWorktype = DB::table('clocks')
                ->join('worktypes', 'clocks.eh_worktype_id', '=', 'worktypes.eh_worktype_id')
                ->whereIn('clocks.eh_location_id', $plLocationIds)
                ->where('clocks.status', 'processed')
                ->whereNotNull('clocks.clock_out')
                ->select(
                    'worktypes.name as worktype',
                    DB::raw('SUM(clocks.hours_worked) as total_hours')
                )
                ->groupBy('worktypes.name')
                ->get()
                ->mapWithKeys(fn($r) => [$r->worktype => round((float) $r->total_hours, 2)])
                ->toArray();
        }

        // Production Analysis — Premier costs from job_cost_details
        $dashSettings = $location->dashboard_settings ?? [];
        $premierWagesItems = $dashSettings['analysis_premier_wages_items'] ?? ['01-01'];
        $premierForemanItems = $dashSettings['analysis_premier_foreman_items'] ?? ['03-01'];
        $premierLhItems = $dashSettings['analysis_premier_lh_items'] ?? ['05-01'];
        $premierLabourerItems = $dashSettings['analysis_premier_labourer_items'] ?? ['07-01'];

        $allPremierItems = array_merge($premierWagesItems, $premierForemanItems, $premierLhItems, $premierLabourerItems);

        $premierCosts = [];
        $premierLatestDate = null;
        if ($location->external_id) {
            $premierQuery = JobCostDetail::where('job_number', $location->external_id)
                ->whereIn('cost_item', $allPremierItems)
                ->where('transaction_date', '<=', $asOfDate->format('Y-m-d'));

            $premierCosts = (clone $premierQuery)
                ->select('cost_item', DB::raw('SUM(amount) as total_amount'))
                ->groupBy('cost_item')
                ->pluck('total_amount', 'cost_item')
                ->toArray();

            $premierLatestDate = (clone $premierQuery)->max('transaction_date');
        }

        // Build premier cost by category
        $premierCostByCategory = [
            'wages' => collect($premierWagesItems)->sum(fn($item) => (float) ($premierCosts[$item] ?? 0)),
            'foreman' => collect($premierForemanItems)->sum(fn($item) => (float) ($premierCosts[$item] ?? 0)),
            'leading_hands' => collect($premierLhItems)->sum(fn($item) => (float) ($premierCosts[$item] ?? 0)),
            'labourer' => collect($premierLabourerItems)->sum(fn($item) => (float) ($premierCosts[$item] ?? 0)),
        ];

        $activeLayout = DashboardLayout::where('is_active', true)->first();
        $isAdmin = $request->user()?->isAdmin();

        return Inertia::render('locations/dashboard', [
            'location' => $location,
            'timelineData' => $timelineData,
            'asOfDate' => $asOfDate->format('Y-m-d'),
            'claimedToDate' => $claimedToDate,
            'cashRetention' => $cashRetention,
            'projectIncomeData' => $projectIncomeData,
            'variationsSummary' => $variationsSummaryData,
            'labourBudgetData' => $labourBudgetData,
            'vendorCommitmentsSummary' => $vendorCommitmentsSummary,
            'pendingPos' => $pendingPos,
            'employeesOnSite' => $employeesOnSite,
            'availableLocations' => $availableLocations,
            'productionCostCodes' => $productionCostCodes,
            'productionUploads' => $productionUploads,
            'selectedUploadId' => $selectedUpload?->id,
            'productionLines' => $productionLines,
            'industrialActionHours' => round($industrialActionHours, 1),
            'varianceTrend' => $varianceTrend,
            'premierCostByCategory' => $premierCostByCategory,
            'premierLatestDate' => $premierLatestDate,
            'payrollHoursByWorktype' => $payrollHoursByWorktype,
            'dpcPercentComplete' => $dpcPercentComplete,
            'activeLayout' => $activeLayout ? [
                'id' => $activeLayout->id,
                'name' => $activeLayout->name,
                'grid_layout' => $activeLayout->grid_layout,
                'hidden_widgets' => $activeLayout->hidden_widgets,
            ] : null,
            'allLayouts' => $isAdmin
                ? DashboardLayout::select('id', 'name', 'is_active')->orderByDesc('is_active')->orderBy('name')->get()
                : null,
        ]);
    }

    public function saveDashboardSettings(Request $request, Location $location)
    {
        $request->validate([
            'safety_cost_code' => 'nullable|string|max:50',
            'weather_cost_code' => 'nullable|string|max:50',
            'analysis_foreman_codes' => 'nullable|array',
            'analysis_foreman_codes.*' => 'string|max:50',
            'analysis_leading_hands_codes' => 'nullable|array',
            'analysis_leading_hands_codes.*' => 'string|max:50',
            'analysis_labourer_codes' => 'nullable|array',
            'analysis_labourer_codes.*' => 'string|max:50',
            'analysis_wages_worktypes' => 'nullable|array',
            'analysis_wages_worktypes.*' => 'string|max:100',
            'analysis_foreman_worktypes' => 'nullable|array',
            'analysis_foreman_worktypes.*' => 'string|max:100',
            'analysis_leading_hands_worktypes' => 'nullable|array',
            'analysis_leading_hands_worktypes.*' => 'string|max:100',
            'analysis_labourer_worktypes' => 'nullable|array',
            'analysis_labourer_worktypes.*' => 'string|max:100',
            'analysis_premier_wages_items' => 'nullable|array',
            'analysis_premier_wages_items.*' => 'string|max:20',
            'analysis_premier_foreman_items' => 'nullable|array',
            'analysis_premier_foreman_items.*' => 'string|max:20',
            'analysis_premier_lh_items' => 'nullable|array',
            'analysis_premier_lh_items.*' => 'string|max:20',
            'analysis_premier_labourer_items' => 'nullable|array',
            'analysis_premier_labourer_items.*' => 'string|max:20',
            'dpc_hourly_rate' => 'nullable|numeric|min:0',
            'dpc_rates' => 'nullable|array',
            'dpc_rates.wages' => 'nullable|numeric|min:0',
            'dpc_rates.foreman' => 'nullable|numeric|min:0',
            'dpc_rates.leading_hands' => 'nullable|numeric|min:0',
            'dpc_rates.labourer' => 'nullable|numeric|min:0',
        ]);

        $settings = $location->dashboard_settings ?? [];

        $allowedKeys = [
            'safety_cost_code', 'weather_cost_code',
            'analysis_foreman_codes', 'analysis_leading_hands_codes', 'analysis_labourer_codes',
            'analysis_wages_worktypes', 'analysis_foreman_worktypes', 'analysis_leading_hands_worktypes', 'analysis_labourer_worktypes',
            'analysis_premier_wages_items', 'analysis_premier_foreman_items',
            'analysis_premier_lh_items', 'analysis_premier_labourer_items',
            'dpc_hourly_rate', 'dpc_rates',
        ];

        foreach ($allowedKeys as $key) {
            if ($request->has($key)) {
                $settings[$key] = $request->input($key);
            }
        }

        $location->update(['dashboard_settings' => $settings]);

        return response()->json(['success' => true]);
    }

    private function getTimelineData($location)
    {
        if (!$location->jobSummary) {
            return null;
        }

        // Get actual start date from first job cost transaction
        $actualStartDate = null;
        if ($location->external_id) {
            $firstTransaction = DB::table('job_cost_details')
                ->where('job_number', $location->external_id)
                ->whereNotNull('transaction_date')
                ->orderBy('transaction_date', 'asc')
                ->first();

            if ($firstTransaction) {
                $actualStartDate = $firstTransaction->transaction_date;
            }
        }

        return [
            'start_date' => $location->jobSummary->start_date,
            'estimated_end_date' => $location->jobSummary->estimated_end_date,
            'actual_end_date' => $location->jobSummary->actual_end_date,
            'actual_start_date' => $actualStartDate,
            'status' => $location->jobSummary->status,
        ];
    }

    /**
     * Calculate total claimed to date from AR progress billing.
     * Sums individual claim amounts (non-cumulative) up to the selected date.
     */
    private function calculateClaimedToDate($location, $asOfDate)
    {
        if (!$location->external_id) {
            return 0;
        }

        // Sum individual claim amounts (this_app_work_completed is not cumulative)
        $claimed = DB::table('ar_progress_billing_summaries')
            ->where('job_number', $location->external_id)
            ->where('period_end_date', '<=', $asOfDate->format('Y-m-d'))
            ->where('active', 1)
            ->sum('this_app_work_completed');

        return $claimed ?? 0;
    }

    /**
     * Calculate cash retention from AR progress billing.
     * Sums individual retainage amounts (non-cumulative) up to the selected date.
     */
    private function calculateCashRetention($location, $asOfDate)
    {
        if (!$location->external_id) {
            return 0;
        }

        // Sum individual retainage amounts (this_app_retainage is not cumulative)
        $retention = DB::table('ar_progress_billing_summaries')
            ->where('job_number', $location->external_id)
            ->where('period_end_date', '<=', $asOfDate->format('Y-m-d'))
            ->where('active', 1)
            ->sum('this_app_retainage');

        return $retention ?? 0;
    }

    private function getMonthlySpending($location)
    {
        if (! $location->external_id) {
            return collect();
        }

        $driver = DB::getDriverName();
        $monthExpression = $driver === 'sqlite'
            ? "strftime('%Y-%m', transaction_date)"
            : "DATE_FORMAT(transaction_date, '%Y-%m')";

        return DB::table('ap_posted_invoice_lines')
            ->selectRaw("$monthExpression as month, SUM(amount) as total")
            ->where('line_job', $location->external_id)
            ->whereNotNull('transaction_date')
            ->groupBy('month')
            ->orderBy('month')
            ->get();
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Location $location)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Location $location)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Location $location)
    {
        //
    }

    public function updateVariationNumberStart(Request $request, Location $location): \Illuminate\Http\JsonResponse
    {
        $validated = $request->validate([
            'variation_number_start' => 'required|integer|min:1',
        ]);

        $location->update([
            'variation_number_start' => $validated['variation_number_start'],
            'variation_next_number' => $validated['variation_number_start'],
        ]);

        return response()->json(['variation_number_start' => $location->variation_number_start]);
    }

    public function close(Location $location)
    {
        $location->update([
            'closed_at' => now(),
            'closed_by' => auth()->id(),
        ]);

        return back()->with('success', "{$location->name} has been closed.");
    }

    public function reopen(Location $location)
    {
        $location->update([
            'closed_at' => null,
            'closed_by' => null,
        ]);

        return back()->with('success', "{$location->name} has been reopened.");
    }

    public function sync()
    {
        $apiKey = config('services.employment_hero.api_key');
        // $apiKey = 'PAYROLL_API_KEY';
        $user = auth()->user();
        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($apiKey.':'),
        ])->get('https://api.yourpayroll.com.au/api/v2/business/431152/location');

        if ($response->failed()) {
            $user->notify(new \App\Notifications\LocationSyncNotification('failed', 'Failed to connect to Employment Hero API. Message: '.$response->body()));

            return back()->with('error', 'Failed to connect to Employment Hero API.');
        }

        $locationData = $response->json();
        if (! is_array($locationData) || empty($locationData)) {
            $user->notify(new \App\Notifications\LocationSyncNotification('failed', 'Failed to fetch locations from Employment Hero. Message: '.$response->body()));

            return back()->with('error', 'Failed to fetch locations from Employment Hero.');
        }

        $remoteIds = collect($locationData)
            ->pluck('id')
            ->filter()
            ->unique()
            ->values();

        $restoredCount = 0;
        $deletedCount = 0;

        DB::transaction(function () use ($locationData, $remoteIds, &$restoredCount, &$deletedCount) {

            // Restore previously deleted ones that now exist in EH
            $restoredCount = Location::onlyTrashed()
                ->whereIn('eh_location_id', $remoteIds)
                ->restore();

            // Upsert + sync worktypes
            foreach ($locationData as $loc) {
                $model = Location::updateOrCreate(
                    ['eh_location_id' => $loc['id']],
                    [
                        'name' => $loc['name'] ?? null,
                        'fully_qualified_name' => $loc['fullyQualifiedName'] ?? null,
                        'eh_parent_id' => $loc['parentId'] ?? null,
                        'external_id' => $loc['externalId'] ?? null,
                        'state' => $loc['state'] ?? null,
                    ]
                );

                if (! empty($loc['defaultShiftConditionIds']) && is_array($loc['defaultShiftConditionIds'])) {
                    $worktypeIds = Worktype::whereIn('eh_worktype_id', $loc['defaultShiftConditionIds'])
                        ->pluck('id')
                        ->all();
                    $model->worktypes()->sync($worktypeIds);
                }
            }

            // Soft-delete locations missing from EH
            $deletedCount = Location::whereNotIn('eh_location_id', $remoteIds)
                ->whereNull('deleted_at')
                ->update(['deleted_at' => now()]);
        });

        $user = auth()->user();
        $status = 'success';
        $message = "Locations synced successfully, {$restoredCount} restored, {$deletedCount} deleted.";
        $user->notify(new \App\Notifications\LocationSyncNotification($status, $message));

        return back()->with(
            'success',
            $message
        );
    }

    public function createSubLocation(Request $request)
    {
        $request->validate([
            'level' => 'required|string|max:64',
            'activity' => 'required|string|max:64',
            'location_id' => 'required|integer',
        ]);

        $parentLocation = Location::find($request->location_id);
        if (! $parentLocation) {
            return redirect()->back()->with('error', 'Parent location not found.');
        }
        $data = [
            'defaultShiftConditionIds' => $parentLocation->worktypes->pluck('eh_worktype_id')->toArray(),
            'country' => 'Australia',
            'name' => $request->level.'-'.$request->activity,
            'parentId' => $parentLocation->eh_location_id,
            'state' => 'QLD',
            'source' => 'API - Portal',
            'isRollupReportingLocation' => true,
            'externalId' => $parentLocation->external_id.'::'.$request->level.'-'.$request->activity,
        ];

        $this->createEHLocation($data);

    }

    private function createEHLocation($data)
    {
        $apiKey = config('services.employment_hero.api_key');
        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($apiKey.':'),  // Manually encode the API key
        ])->post('https://api.yourpayroll.com.au/api/v2/business/431152/location', $data);

        if ($response->successful()) {
            $this->sync();

            return redirect()->back()->with('success', 'Sub-location created successfully.');
        } else {
            return redirect()->back()->with('error', 'Failed to create sub-location.');
        }

    }

    /**
     * Load all timesheets from EH for a location (backfill).
     */
    public function loadTimesheets(Location $location)
    {
        \App\Jobs\LoadTimesheetsForLocation::dispatch($location->id);

        return redirect()->back()->with('success', "Timesheet sync dispatched for {$location->name} (all time).");
    }

    public function LoadJobDataFromPremier(Location $location)
    {

        \App\Jobs\LoadJobCostData::dispatch();

        return redirect()->back()->with('success', 'Job Cost Details loading initiated.');
    }

    /**
     * Load all job data from Premier (Cost Details, Reports, and AR Progress Billing)
     */
    public function loadJobData()
    {
        try {
            // Dispatch all jobs
            \App\Jobs\LoadJobSummaries::dispatch();
            \App\Jobs\LoadJobCostData::dispatch();
            \App\Jobs\LoadJobReportByCostItemAndCostTypes::dispatch();
            \App\Jobs\LoadArProgressBillingSummaries::dispatch();
            \App\Jobs\LoadArPostedInvoices::dispatch();
            \App\Jobs\LoadApPostedInvoices::dispatch();
            \App\Jobs\LoadApPostedInvoiceLines::dispatch();
            \App\Jobs\LoadJobVendorCommitments::dispatch();
            \App\Jobs\SyncJobAddressesFromPremier::dispatch();

            return redirect()->back()->with('success', 'Data download initiated. All jobs have been queued.');
        } catch (\Exception $e) {
            \Log::error('Failed to dispatch job data loading jobs', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->back()->with('error', 'Failed to initiate data download: '.$e->getMessage());
        }
    }

    /**
     * Return sync status for all Premier data jobs.
     */
    public function syncStatus()
    {
        $jobMap = [
            'job_summaries' => ['label' => 'Job Summaries', 'class' => \App\Jobs\LoadJobSummaries::class],
            'job_cost_data' => ['label' => 'Job Cost Details', 'class' => \App\Jobs\LoadJobCostData::class],
            'job_report_by_cost_item' => ['label' => 'Job Report by Cost Item', 'class' => \App\Jobs\LoadJobReportByCostItemAndCostTypes::class],
            'ar_progress_billing' => ['label' => 'AR Progress Billing', 'class' => \App\Jobs\LoadArProgressBillingSummaries::class],
            'ar_posted_invoices' => ['label' => 'AR Posted Invoices', 'class' => \App\Jobs\LoadArPostedInvoices::class],
            'ap_posted_invoices' => ['label' => 'AP Posted Invoices', 'class' => \App\Jobs\LoadApPostedInvoices::class],
            'ap_posted_invoice_lines' => ['label' => 'AP Posted Invoice Lines', 'class' => \App\Jobs\LoadApPostedInvoiceLines::class],
            'job_vendor_commitments' => ['label' => 'Job Vendor Commitments', 'class' => \App\Jobs\LoadJobVendorCommitments::class],
            'ap_purchase_orders' => ['label' => 'AP Purchase Orders', 'class' => \App\Jobs\LoadApPurchaseOrders::class],
            'gl_transaction_details' => ['label' => 'GL Transaction Details', 'class' => \App\Jobs\LoadGlTransactionDetails::class],
            'variations' => ['label' => 'Variations (Change Orders)', 'class' => null],
            'premier_vendors' => ['label' => 'Premier Vendors', 'class' => null],
            'premier_gl_accounts' => ['label' => 'Premier GL Accounts', 'class' => null],
            'job_addresses' => ['label' => 'Job Addresses & Geocoding', 'class' => \App\Jobs\SyncJobAddressesFromPremier::class],
        ];

        $syncLogs = \App\Models\DataSyncLog::all()->keyBy('job_name');

        $jobs = [];
        foreach ($jobMap as $key => $meta) {
            $log = $syncLogs->get($key);
            $jobs[] = [
                'key' => $key,
                'label' => $meta['label'],
                'last_synced_at' => $log?->last_successful_sync?->toIso8601String(),
                'last_filter_value' => $log?->last_filter_value,
                'records_synced' => $log?->records_synced ?? 0,
            ];
        }

        return response()->json($jobs);
    }

    /**
     * Dispatch selected Premier data sync jobs.
     */
    public function dispatchSyncJobs(Request $request)
    {
        $validated = $request->validate([
            'jobs' => 'required|array|min:1',
            'jobs.*' => 'string|in:job_summaries,job_cost_data,job_report_by_cost_item,ar_progress_billing,ar_posted_invoices,ap_posted_invoices,ap_posted_invoice_lines,job_vendor_commitments,ap_purchase_orders,gl_transaction_details,variations,premier_vendors,premier_gl_accounts,job_addresses',
            'force_full' => 'boolean',
        ]);

        $forceFullSync = $validated['force_full'] ?? false;

        $jobClassMap = [
            'job_summaries' => \App\Jobs\LoadJobSummaries::class,
            'job_cost_data' => \App\Jobs\LoadJobCostData::class,
            'job_report_by_cost_item' => \App\Jobs\LoadJobReportByCostItemAndCostTypes::class,
            'ar_progress_billing' => \App\Jobs\LoadArProgressBillingSummaries::class,
            'ar_posted_invoices' => \App\Jobs\LoadArPostedInvoices::class,
            'ap_posted_invoices' => \App\Jobs\LoadApPostedInvoices::class,
            'ap_posted_invoice_lines' => \App\Jobs\LoadApPostedInvoiceLines::class,
            'job_vendor_commitments' => \App\Jobs\LoadJobVendorCommitments::class,
            'ap_purchase_orders' => \App\Jobs\LoadApPurchaseOrders::class,
            'gl_transaction_details' => \App\Jobs\LoadGlTransactionDetails::class,
            'job_addresses' => \App\Jobs\SyncJobAddressesFromPremier::class,
        ];

        $dispatched = [];
        foreach ($validated['jobs'] as $jobKey) {
            if ($jobKey === 'variations') {
                \Artisan::call('premier:sync-variations');
                $dispatched[] = $jobKey;
                continue;
            }

            if ($jobKey === 'premier_vendors') {
                \Artisan::call('premier:sync-vendors');
                \App\Models\DataSyncLog::updateOrCreate(
                    ['job_name' => 'premier_vendors'],
                    ['last_successful_sync' => now(), 'records_synced' => \App\Models\PremierVendor::count()]
                );
                $dispatched[] = $jobKey;
                continue;
            }

            if ($jobKey === 'premier_gl_accounts') {
                \Artisan::call('premier:sync-gl-accounts');
                \App\Models\DataSyncLog::updateOrCreate(
                    ['job_name' => 'premier_gl_accounts'],
                    ['last_successful_sync' => now(), 'records_synced' => \App\Models\PremierGlAccount::count()]
                );
                $dispatched[] = $jobKey;
                continue;
            }

            $class = $jobClassMap[$jobKey];
            // Jobs that support forceFullSync parameter
            $supportsForce = in_array($jobKey, [
                'job_cost_data', 'ap_posted_invoices', 'ap_posted_invoice_lines', 'ar_posted_invoices', 'ap_purchase_orders', 'gl_transaction_details',
            ]);

            if ($supportsForce) {
                $class::dispatch($forceFullSync);
            } else {
                $class::dispatch();
            }
            $dispatched[] = $jobKey;
        }

        return response()->json([
            'message' => count($dispatched).' job(s) dispatched.',
            'dispatched' => $dispatched,
        ]);
    }

    /**
     * Attach material items to a location with pricing configuration.
     */
    public function attachMaterials(Request $request, Location $location)
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.material_item_id' => 'required|exists:material_items,id',
            'items.*.unit_cost_override' => 'required|numeric|min:0',
            'items.*.is_locked' => 'required|boolean',
        ]);

        // Get existing items with their current values to determine if this is create or update
        $existingItems = $location->materialItems()
            ->whereIn('material_item_id', array_column($validated['items'], 'material_item_id'))
            ->get()
            ->keyBy('id');

        $attachData = [];
        foreach ($validated['items'] as $item) {
            $attachData[$item['material_item_id']] = [
                'unit_cost_override' => $item['unit_cost_override'],
                'is_locked' => $item['is_locked'],
                'updated_by' => auth()->id(),
            ];
        }

        // syncWithoutDetaching will add new items and update existing ones
        // without removing items not in the current request
        $location->materialItems()->syncWithoutDetaching($attachData);

        // Log history for each item
        foreach ($validated['items'] as $item) {
            $existing = $existingItems->get($item['material_item_id']);
            $isUpdate = $existing !== null;

            LocationItemPriceHistory::log(
                $location->id,
                $item['material_item_id'],
                $item['unit_cost_override'],
                $item['is_locked'],
                auth()->id(),
                $isUpdate ? 'updated' : 'created',
                $isUpdate ? (float) $existing->pivot->unit_cost_override : null,
                $isUpdate ? (bool) $existing->pivot->is_locked : null
            );
        }

        return back()->with('success', count($validated['items']).' material(s) attached to price list.');
    }

    /**
     * Update a single material item's price for a location.
     */
    public function updateMaterialPrice(Request $request, Location $location, $materialItemId)
    {
        $validated = $request->validate([
            'unit_cost_override' => 'required|numeric|min:0',
            'is_locked' => 'required|boolean',
        ]);

        // Check if the item exists in the pivot table
        $existing = $location->materialItems()->where('material_item_id', $materialItemId)->first();

        if (! $existing) {
            return back()->with('error', 'Material item not found in price list.');
        }

        // Check if the item is locked (cannot edit locked items)
        if ($existing->pivot->is_locked && ! $validated['is_locked']) {
            // Allow unlocking, but check if user has permission (for now, allow it)
        }

        $location->materialItems()->updateExistingPivot($materialItemId, [
            'unit_cost_override' => $validated['unit_cost_override'],
            'is_locked' => $validated['is_locked'],
            'updated_by' => auth()->id(),
        ]);

        // Log price history with previous values
        LocationItemPriceHistory::log(
            $location->id,
            (int) $materialItemId,
            $validated['unit_cost_override'],
            $validated['is_locked'],
            auth()->id(),
            'updated',
            (float) $existing->pivot->unit_cost_override,
            (bool) $existing->pivot->is_locked
        );

        return back()->with('success', 'Price updated successfully.');
    }

    /**
     * Remove a material item from a location's price list.
     */
    public function detachMaterial(Location $location, $materialItemId)
    {
        // Get the current data before removing for history
        $existing = $location->materialItems()->where('material_item_id', $materialItemId)->first();

        if (! $existing) {
            return back()->with('error', 'Material item not found in price list.');
        }

        // Prevent deletion of locked items
        if ($existing->pivot->is_locked) {
            return back()->with('error', 'Cannot remove a locked item. Unlock it first.');
        }

        // Log the deletion to history before removing
        LocationItemPriceHistory::log(
            $location->id,
            (int) $materialItemId,
            $existing->pivot->unit_cost_override,
            $existing->pivot->is_locked,
            auth()->id(),
            'deleted'
        );

        // Remove the item from the pivot table
        $location->materialItems()->detach($materialItemId);

        return back()->with('success', 'Material removed from price list.');
    }

    /**
     * Get the price history for a material item at a location.
     */
    public function getMaterialPriceHistory(Location $location, $materialItemId)
    {
        $history = LocationItemPriceHistory::where('location_id', $location->id)
            ->where('material_item_id', $materialItemId)
            ->with('changedByUser:id,name')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($record) {
                return [
                    'id' => $record->id,
                    'unit_cost_override' => $record->unit_cost_override,
                    'previous_unit_cost' => $record->previous_unit_cost,
                    'is_locked' => $record->is_locked,
                    'previous_is_locked' => $record->previous_is_locked,
                    'change_type' => $record->change_type,
                    'changed_by_name' => $record->changedByUser?->name ?? 'Unknown',
                    'created_at' => $record->created_at->toISOString(),
                ];
            });

        return response()->json($history);
    }

    /**
     * Get all price history for a location.
     */
    public function getLocationPriceHistory(Location $location)
    {
        $history = LocationItemPriceHistory::where('location_id', $location->id)
            ->with(['changedByUser:id,name', 'materialItem:id,code,description'])
            ->orderBy('created_at', 'desc')
            ->limit(500) // Limit to prevent performance issues
            ->get()
            ->map(function ($record) {
                return [
                    'id' => $record->id,
                    'material_item_id' => $record->material_item_id,
                    'material_code' => $record->materialItem?->code ?? 'Unknown',
                    'material_description' => $record->materialItem?->description ?? '',
                    'unit_cost_override' => $record->unit_cost_override,
                    'previous_unit_cost' => $record->previous_unit_cost,
                    'is_locked' => $record->is_locked,
                    'previous_is_locked' => $record->previous_is_locked,
                    'change_type' => $record->change_type,
                    'changed_by_name' => $record->changedByUser?->name ?? 'Unknown',
                    'created_at' => $record->created_at->toISOString(),
                ];
            });

        return response()->json($history);
    }

    /**
     * Download a CSV report of locations with external IDs that don't match the expected format.
     *
     * Expected formats:
     *   Parent:  JOBNUMBER::
     *   Sub:     JOBNUMBER::LEVEL-CODE_ACTIVITY
     */
    public function externalIdValidationReport(Request $request)
    {
        // Pattern: JOBNUMBER:: (parent) or JOBNUMBER::LEVEL-CODE_ACTIVITY (sub)
        // JOBNUMBER = uppercase alphanumeric
        // LEVEL = uppercase alphanumeric with underscores (e.g. LEVEL_01, GROUND, BASEMENT, VAR)
        // CODE = digits (e.g. 001, 401, 906)
        // ACTIVITY = required, uppercase alphanumeric with underscores (no spaces)
        $parentPattern = '/^[A-Z0-9]+::$/';
        $subPattern    = '/^[A-Z0-9]+::[A-Z0-9_]+-[0-9]{3}_[A-Z0-9_\/&\-]+$/';

        $query = Location::whereNotNull('external_id')
            ->where('external_id', '!=', '');

        if ($request->filled('job')) {
            $query->where('external_id', 'like', strtoupper($request->job) . '%');
        }

        $locations = $query->orderBy('external_id')->get(['id', 'name', 'external_id', 'eh_parent_id']);

        $issues = [];

        foreach ($locations as $loc) {
            $extId = $loc->external_id;
            $problems = [];

            // Check case — should be all uppercase
            if ($extId !== strtoupper($extId)) {
                $problems[] = 'Contains lowercase characters';
            }

            // No spaces allowed anywhere
            if (preg_match('/\s/', $extId)) {
                $problems[] = 'Contains spaces';
            }

            // No parentheses allowed
            if (preg_match('/[()]/', $extId)) {
                $problems[] = 'Contains parentheses';
            }

            // Check for double prefix (e.g. MAR01::MAR::...)
            if (preg_match('/^[A-Z0-9]+::[A-Z0-9]+::/', strtoupper($extId))) {
                $problems[] = 'Double prefix (job number repeated)';
            }

            // Missing :: separator entirely (has content after job number but no ::)
            if (! str_contains($extId, '::') && preg_match('/^[A-Z0-9]+[A-Z_]/', strtoupper($extId)) && strlen($extId) > 6) {
                $problems[] = 'Missing :: separator';
            }

            // If it has :: check if it matches parent or sub pattern
            $upper = strtoupper(trim($extId));
            if (str_contains($extId, '::')) {
                $isParent = preg_match($parentPattern, $upper);
                $isSub = preg_match($subPattern, $upper);

                if (! $isParent && ! $isSub) {
                    $parts = explode('::', $upper, 2);
                    $suffix = end($parts);

                    if (! empty($suffix)) {
                        if (! str_contains($suffix, '-')) {
                            $problems[] = 'Missing - separator between level and code';
                        } elseif (! str_contains($suffix, '_')) {
                            $problems[] = 'Missing _ separator between code and activity';
                        } elseif (preg_match('/-[0-9]{3}_$/', $suffix)) {
                            $problems[] = 'Missing activity description after code (e.g. -001_ACTIVITY)';
                        } else {
                            $problems[] = 'Does not match expected format (LEVEL-CODE_ACTIVITY)';
                        }
                    }
                }
            }

            // Check for missing activity even if format otherwise matches
            if (str_contains($extId, '::') && preg_match('/-[0-9]{3}$/', $extId)) {
                $problems[] = 'Missing activity description after code (e.g. -001_ACTIVITY)';
            }

            if (! empty($problems)) {
                $issues[] = [
                    'id' => $loc->id,
                    'name' => $loc->name,
                    'external_id' => $extId,
                    'issues' => implode('; ', $problems),
                ];
            }
        }

        // Generate CSV
        $filename = 'external_id_validation_' . ($request->job ?? 'all') . '_' . now()->format('Y-m-d') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($issues) {
            $file = fopen('php://output', 'w');
            fputcsv($file, ['Location ID', 'Name', 'External ID', 'Issues']);

            foreach ($issues as $row) {
                fputcsv($file, [$row['id'], $row['name'], $row['external_id'], $row['issues']]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
