<?php

namespace App\Http\Controllers;


use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Supplier;
use App\Models\Location;

class PurchasingController extends Controller
{
    public function create()
    {
        $suppliers = Supplier::all();

        $locations = Location::where('eh_parent_id', 1149031)->get();
        return Inertia::render('purchasing/create', [
            'suppliers' => $suppliers,
            'locations' => $locations,
        ]);
    }
}
