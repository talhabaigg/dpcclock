<?php

namespace App\Http\Controllers;

use App\Models\Location;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use App\Models\Worktype;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;


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
            'costCodes' => fn($query) => $query->orderByRaw('CAST(code AS UNSIGNED)'),
            'materialItems.supplier',
            'favouriteMaterials',
            'variations',
            'requisitions' => fn($query) => $query->withSum('lineItems', 'total_cost'),
        ]);

        $monthlySpending = $this->getMonthlySpending($location);
        // dd($monthlySpending);

        // Fetch sub-locations for the specified location
        $location->subLocations = Location::where('eh_parent_id', $location->eh_location_id)->get();

        // dd($location->materialItems);

        return Inertia::render('locations/show', [
            'location' => $location,
            'monthlySpending' => $monthlySpending
        ]);
    }

    private function getMonthlySpending($location)
    {
        $driver = DB::getDriverName();
        $monthExpression = $driver === 'sqlite'
            ? "strftime('%Y-%m', requisitions.created_at)"
            : "DATE_FORMAT(requisitions.created_at, '%Y-%m')";
        $monthlySpending = DB::table('requisitions')
            ->join('requisition_line_items', 'requisitions.id', '=', 'requisition_line_items.requisition_id')
            ->selectRaw("$monthExpression as month, SUM(requisition_line_items.total_cost) as total")
            ->where('requisitions.project_number', $location->id)
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        return $monthlySpending;
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
        $apiKey = env('PAYROLL_API_KEY');
        // $apiKey = 'PAYROLL_API_KEY';
        $user = auth()->user();
        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':'),
        ])->get("https://api.yourpayroll.com.au/api/v2/business/431152/location");

        if ($response->failed()) {
            $user->notify(new \App\Notifications\LocationSyncNotification('failed', 'Failed to connect to Employment Hero API. Message: ' . $response->body()));
            return back()->with('error', 'Failed to connect to Employment Hero API.');
        }

        $locationData = $response->json();
        if (!is_array($locationData) || empty($locationData)) {
            $user->notify(new \App\Notifications\LocationSyncNotification('failed', 'Failed to fetch locations from Employment Hero. Message: ' . $response->body()));
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

                if (!empty($loc['defaultShiftConditionIds']) && is_array($loc['defaultShiftConditionIds'])) {
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
        if (!$parentLocation) {
            return redirect()->back()->with('error', 'Parent location not found.');
        }
        $data = [
            'defaultShiftConditionIds' => $parentLocation->worktypes->pluck('eh_worktype_id')->toArray(),
            'country' => 'Australia',
            'name' => $request->level . '-' . $request->activity,
            'parentId' => $parentLocation->eh_location_id,
            'state' => 'QLD',
            'source' => 'API - Portal',
            'isRollupReportingLocation' => true,
            'externalId' => $parentLocation->external_id . '::' . $request->level . '-' . $request->activity,
        ];

        $this->createEHLocation($data);



    }

    private function createEHLocation($data)
    {
        $apiKey = env('PAYROLL_API_KEY');
        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':')  // Manually encode the API key
        ])->post("https://api.yourpayroll.com.au/api/v2/business/431152/location", $data);

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
            // Dispatch all three jobs
            \App\Jobs\LoadJobCostData::dispatch();
            \App\Jobs\LoadJobReportByCostItemAndCostTypes::dispatch();
            \App\Jobs\LoadArProgressBillingSummaries::dispatch();

            return redirect()->back()->with('success', 'Data download initiated. All three jobs have been queued: Job Cost Details, Job Report by Cost Item & Cost Types, and AR Progress Billing Summaries.');
        } catch (\Exception $e) {
            \Log::error('Failed to dispatch job data loading jobs', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return redirect()->back()->with('error', 'Failed to initiate data download: ' . $e->getMessage());
        }
    }

}
