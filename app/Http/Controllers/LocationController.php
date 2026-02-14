<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\LocationItemPriceHistory;
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
     * Display the specified resource.
     */
    public function show(Location $location)
    {
        $location->load([
            'worktypes',
            'costCodes' => fn ($query) => $query->orderByRaw('CAST(code AS UNSIGNED)'),
            'materialItems.supplier',
            'favouriteMaterials',
            'variations',
            'requisitions' => fn ($query) => $query->withSum('lineItems', 'total_cost'),
        ]);

        // Load user names for material items updated_by
        $userIds = $location->materialItems->pluck('pivot.updated_by')->filter()->unique()->values();
        $users = \App\Models\User::whereIn('id', $userIds)->pluck('name', 'id');

        // Attach user names to material items
        $location->materialItems->each(function ($item) use ($users) {
            $item->pivot->updated_by_name = $item->pivot->updated_by ? ($users[$item->pivot->updated_by] ?? null) : null;
        });

        $monthlySpending = $this->getMonthlySpending($location);

        // Fetch sub-locations for the specified location
        $location->subLocations = Location::where('eh_parent_id', $location->eh_location_id)->get();

        return Inertia::render('locations/show', [
            'location' => $location,
            'monthlySpending' => $monthlySpending,
        ]);
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
