<?php

namespace App\Http\Controllers;

use App\Models\CostCode;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CostcodeController extends Controller
{
    public function index()
    {
        return Inertia::render('costCodes/index', [
            'costcodes' => CostCode::all()->sortBy('name'),
        ]);
    }

    public function download()
    {
        $fileName = 'costcodes_' . now()->format('Ymd_His') . '.csv';
        $headers = ['code', 'description'];
        $costCodes = CostCode::select($headers)->get()->toArray();

        array_unshift($costCodes, $headers);

        return response()->streamDownload(function () use ($costCodes) {
            $handle = fopen('php://output', 'w');
            foreach ($costCodes as $row) {
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
            CostCode::updateOrCreate(
                ['code' => $row[0]], // match on code
                ['description' => $row[1]]  // update or create name
            );
        }

        fclose($handle);

        return redirect()->back()->with('success', 'Cost Codes imported successfully.');
    }
}
