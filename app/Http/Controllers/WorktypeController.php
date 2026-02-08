<?php

namespace App\Http\Controllers;

use App\Models\Worktype;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Inertia\Inertia;

class WorktypeController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $worktypes = Worktype::orderBy('mapping_type', 'desc')->get();

        return Inertia::render('worktypes/index', [
            'worktypes' => $worktypes,
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
    public function show(Worktype $worktype)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Worktype $worktype)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Worktype $worktype)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Worktype $worktype)
    {
        //
    }

    public function syncWorktypes()
    {
        $apiKey = config('services.employment_hero.api_key');
        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($apiKey.':'),  // Manually encode the API key
        ])->get('https://api.yourpayroll.com.au/api/v2/business/431152/worktype');
        $worktypeData = $response->json();
        // $locationData = array_slice($locationData, 0, length: 1);
        foreach ($worktypeData as $worktype) {
            Worktype::updateOrCreate([
                'eh_worktype_id' => $worktype['id'],
            ], [
                'name' => $worktype['name'],
                'eh_external_id' => $worktype['externalId'] ?? null,
                'mapping_type' => $worktype['mappingType'] ?? Str::uuid(),
            ]);
        }

        // dd('synced');
        return redirect()->back()->with('success', 'Worktypes synced from Employment Hero.');

    }
}
