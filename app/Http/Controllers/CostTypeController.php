<?php

namespace App\Http\Controllers;

use App\Models\CostType;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CostTypeController extends Controller
{
    public function index()
    {
        $costTypes = CostType::all();
        return Inertia::render('costTypes/index', [
            'costTypes' => $costTypes
        ]);
    }
    public function download()
    {
        $fileName = 'costtypes_' . now()->format('Ymd_His') . '.csv';
        $headers = ['code', 'description'];
        $costTypes = CostType::select($headers)->get()->toArray();

        array_unshift($costTypes, $headers);

        return response()->streamDownload(function () use ($costTypes) {
            $handle = fopen('php://output', 'w');
            foreach ($costTypes as $row) {
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
            CostType::updateOrCreate(
                ['code' => $row[0]], // match on code
                ['description' => $row[1]]  // update or create name
            );
        }

        fclose($handle);

        return redirect()->back()->with('success', 'Cost Types imported successfully.');
    }
}
