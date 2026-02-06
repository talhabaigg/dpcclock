<?php

namespace App\Http\Controllers;

use App\Models\Supplier;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SupplierController extends Controller
{
    public function getSuppliers()
    {
        // Fetch suppliers from the database
        $suppliers = \App\Models\Supplier::all();

        // Return the suppliers as a JSON response
        return response()->json($suppliers);
    }

    public function index()
    {
        return Inertia::render('suppliers/index', [
            'suppliers' => Supplier::all(),
        ]);
    }

    public function download()
    {
        $fileName = 'suppliers_'.now()->format('Ymd_His').'.csv';
        $headers = ['name', 'code'];
        $suppliers = Supplier::select($headers)->get()->toArray();

        array_unshift($suppliers, $headers);

        return response()->streamDownload(function () use ($suppliers) {
            $handle = fopen('php://output', 'w');
            foreach ($suppliers as $row) {
                fputcsv($handle, $row);
            }
            fclose($handle);
        }, $fileName);
    }

    public function upload(Request $request)
    {
        // Validate uploaded file
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:2048', // 2MB max
        ]);

        $file = $request->file('file');
        $handle = fopen($file->getRealPath(), 'r');

        // Read and skip header row
        $header = fgetcsv($handle);

        while (($row = fgetcsv($handle)) !== false) {
            // Assuming CSV order is: name, code
            Supplier::updateOrCreate(
                ['code' => $row[1]], // match on code
                ['name' => $row[0]]  // update or create name
            );
        }

        fclose($handle);

        return redirect()->back()->with('success', 'Suppliers imported successfully.');
    }
}
