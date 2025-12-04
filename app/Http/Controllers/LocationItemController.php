<?php

namespace App\Http\Controllers;

use App\Models\Location;
use Illuminate\Http\Request;

class LocationItemController extends Controller
{
    public function showLocationItems(Location $location)
    {
        $location->load('materialItems.supplier');

        return inertia('location-items/index', [
            'location' => $location
        ]);

    }
}
