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
        $user = auth()->user();
        $locationsQuery = Location::where(function ($query) {
            $query->where('eh_parent_id', 1149031)
                ->orWhere('eh_parent_id', 1249093)
                ->orWhere('eh_parent_id', 1198645);
        });

        if ($user->hasRole('manager')) {
            $ehLocationIds = $user->managedKiosks()->pluck('eh_location_id');
            $locationsQuery->whereIn('eh_location_id', $ehLocationIds);
        }

        $locations = $locationsQuery->get();

        $costCodes = CostCode::orderBy('code')->get();
        // Logic to show the create variation form
        return Inertia::render('variation/create', [
            'locations' => $locations,
            'costCodes' => $costCodes,
        ]);
    }
}
