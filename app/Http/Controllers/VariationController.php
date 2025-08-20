<?php

namespace App\Http\Controllers;

use App\Models\CostCode;
use App\Models\Location;
use Illuminate\Http\Request;
use Inertia\Inertia;

class VariationController extends Controller
{
    public function index()
    {
        // Logic to retrieve variations
        return Inertia::render('variation/index', [
            'variations' => [], // Replace with actual data retrieval logic
        ]);
    }

    public function create()
    {
        $acceptable_prefixes = ['01', '02', '03', '04', '05', '06', '07', '08'];

        $user = auth()->user();
        $locationsQuery = Location::with([
            'costCodes' => function ($query) use ($acceptable_prefixes) {
                $query->where(function ($q) use ($acceptable_prefixes) {
                    foreach ($acceptable_prefixes as $prefix) {
                        $q->orWhere('code', 'like', $prefix . '%');
                    }
                });
            }
        ])->where(function ($query) {
            $query->where('eh_parent_id', 1149031)
                ->orWhere('eh_parent_id', 1249093)
                ->orWhere('eh_parent_id', 1198645);
        });

        if ($user->hasRole('manager')) {
            $ehLocationIds = $user->managedKiosks()->pluck('eh_location_id');
            $locationsQuery->whereIn('eh_location_id', $ehLocationIds);
        }

        $locations = $locationsQuery->get();
        dd($locations);
        $costCodes = $locations->pluck('costCodes') // Collection of collections
            ->flatten()                             // Merge into one collection
            // Remove duplicates
            ->sortBy('code')                        // Optional: sort by code
            ->values();                             // Reset keys


        $costCodes = CostCode::orderBy('code')->get();
        // Logic to show the create variation form
        return Inertia::render('variation/create', [
            'locations' => $locations,
            'costCodes' => $costCodes,
        ]);
    }

    public function store(Request $request)
    {
        dd($request->all());
    }
}
