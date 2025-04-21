<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function getSuppliers()
    {
        // Fetch suppliers from the database
        $suppliers = \App\Models\Supplier::all();

        // Return the suppliers as a JSON response
        return response()->json($suppliers);
    }
}
