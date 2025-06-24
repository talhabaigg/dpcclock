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
        $locations = Location::with('worktypes')->where('eh_parent_id', 1149031)->orWhere('eh_parent_id', 1198645)->get();

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
            'materialItems',
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
        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':')  // Manually encode the API key
        ])->get("https://api.yourpayroll.com.au/api/v2/business/431152/location");

        $locationData = $response->json();
        // dd($locationData);
        // $locationData = array_slice($locationData, 0, length: 1);


        foreach ($locationData as $location) {
            $locationModel = Location::updateOrCreate([
                'eh_location_id' => $location['id'],
            ], [
                'name' => $location['name'],
                'eh_parent_id' => $location['parentId'] ?? null,
                'external_id' => $location['externalId'] ?? null,
                'state' => $location['state'] ?? null,
            ]);
            // Sync worktypes using shiftConditionIds
            if (!empty($location['defaultShiftConditionIds'])) {
                $worktypeIds = Worktype::whereIn('eh_worktype_id', $location['defaultShiftConditionIds'])->pluck('id')->toArray();
                $locationModel->worktypes()->sync($worktypeIds);
            }
        }
        return redirect()->back()->with('success', 'Locations synced successfully from Employment Hero.');
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

}
