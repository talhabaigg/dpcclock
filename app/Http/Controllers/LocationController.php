<?php

namespace App\Http\Controllers;

use App\Models\JobCostDetail;
use App\Models\JobReportByCostItemAndCostType;
use App\Models\Location;
use App\Models\LocationItemPriceHistory;
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
    public function index()
    {
        // Fetch primary locations
        $locations = Location::with('worktypes')->where('eh_parent_id', 1149031)->orWhere('eh_parent_id', 1198645)->orWhere('eh_parent_id', 1249093)->get();

        // Fetch sub-locations for each primary location
        foreach ($locations as $location) {
            $location->subLocations = Location::where('eh_parent_id', $location->eh_location_id)->get();
        }

        return Inertia::render('locations/index', [
            'locations' => $locations,
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
    private function getLocationWithCounts(Location $location): Location
    {
        $location->load('worktypes');
        $location->subLocations = Location::where('eh_parent_id', $location->eh_location_id)->get();
        $location->tab_counts = [
            'sublocations' => $location->subLocations->count(),
            'cost_codes' => $location->costCodes()->count(),
            'price_list' => $location->materialItems()->count(),
            'favourites' => $location->favouriteMaterials()->count(),
        ];

        return $location;
    }

    /**
     * Display the specified resource (sub-locations tab).
     */
    public function show(Location $location)
    {
        $this->getLocationWithCounts($location);

        return Inertia::render('locations/show', [
            'location' => $location,
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
     * Display the project dashboard.
     */
    public function dashboard(Request $request, Location $location)
    {
        $location->load('jobSummary', 'vendorCommitments');

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

        // Calculate variations summary grouped by type (status = Approved only)
        $variationsSummary = DB::table('variations')
            ->leftJoin('variation_line_items', 'variations.id', '=', 'variation_line_items.variation_id')
            ->where('variations.location_id', $location->id)
            ->where('variations.status', 'Approved')
            ->whereNull('variations.deleted_at')
            ->select('variations.type')
            ->selectRaw('COUNT(DISTINCT variations.id) as qty')
            ->selectRaw('COALESCE(SUM(variation_line_items.revenue), 0) as value')
            ->groupBy('variations.type')
            ->get();

        $totalVariations = $variationsSummary->sum('qty');

        // Aging >30 days count for 'PENDING' type with status = Approved only
        $agingCount = Variation::where('location_id', $location->id)
            ->where('type', 'PENDING')
            ->where('status', 'Approved')
            ->where('co_date', '<=', now()->subDays(30))
            ->count();

        $variationsSummaryData = $variationsSummary->map(fn($row) => [
            'type' => $row->type ?? 'Unknown',
            'qty' => (int) $row->qty,
            'value' => round((float) $row->value, 2),
            'percent_of_total' => $totalVariations > 0
                ? round(($row->qty / $totalVariations) * 100, 1)
                : 0,
            'aging_over_30' => strtoupper($row->type) === 'PENDING' ? $agingCount : null,
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

            // SC = has subcontract_no, PO = everything else
            $scCommitments = $commitments->filter(fn($c) => !empty($c->subcontract_no));
            $poCommitments = $commitments->filter(fn($c) => empty($c->subcontract_no));

            $vendorCommitmentsSummary = [
                'po_outstanding' => round((float) $poCommitments->sum('os_commitment'), 2),
                'sc_outstanding' => round((float) $scCommitments->sum('os_commitment'), 2),
                'sc_summary' => [
                    'value' => round((float) $scCommitments->sum('original_commitment'), 2),
                    'variations' => round((float) $scCommitments->sum('approved_changes'), 2),
                    'invoiced_to_date' => round((float) $scCommitments->sum('total_billed'), 2),
                    'remaining_balance' => round((float) $scCommitments->sum('os_commitment'), 2),
                ],
            ];
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

            $employeesOnSite = [
                'by_type' => $byType,
                'weekly_trend' => $weeklyTrend,
                'total_workers' => $totalWorkers,
            ];
        }

        // Get all locations with job summaries for the selector
        $availableLocations = Location::with('jobSummary')
            ->whereHas('jobSummary')
            ->whereNotNull('external_id')
            ->where('external_id', '!=', '')
            ->orderBy('name')
            ->get()
            ->map(fn($loc) => [
                'id' => $loc->id,
                'name' => $loc->name,
                'external_id' => $loc->external_id,
            ]);

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
            'employeesOnSite' => $employeesOnSite,
            'availableLocations' => $availableLocations,
        ]);
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
}
