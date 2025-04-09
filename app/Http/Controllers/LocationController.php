<?php

namespace App\Http\Controllers;

use App\Models\Location;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use App\Models\Worktype;


class LocationController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        // Fetch primary locations
        $locations = Location::with('worktypes')->where('eh_parent_id', 1149031)->paginate(15);

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
        //
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
            ]);
            // Sync worktypes using shiftConditionIds
            if (!empty($location['defaultShiftConditionIds'])) {
                $worktypeIds = Worktype::whereIn('eh_worktype_id', $location['defaultShiftConditionIds'])->pluck('id')->toArray();
                $locationModel->worktypes()->sync($worktypeIds);
            }
        }
        return redirect()->back()->with('success', 'Locations synced successfully from Employment Hero.');
    }
}
