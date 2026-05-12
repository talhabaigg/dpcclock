<?php

namespace App\Http\Controllers;

use App\Models\CostCode;
use App\Models\CostType;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CostcodeController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'search' => 'nullable|string|max:255',
            'page' => 'nullable|integer|min:1',
        ]);

        $costCodes = CostCode::with('costType')
            ->when($request->search, function ($q, $search) {
                $q->where(function ($q) use ($search) {
                    $q->where('code', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            })
            ->orderBy('code')
            ->paginate(25)
            ->withQueryString();

        return Inertia::render('costCodes/index', [
            'costcodes' => $costCodes,
            'filters' => $request->only(['search']),
        ]);
    }

    public function download()
    {
        $fileName = 'costcodes_'.now()->format('Ymd_His').'.csv';
        $headers = ['code', 'description', 'cost_type_code'];

        $costCodes = CostCode::with('costType')->orderBy('code')->get()->map(function ($costCode) {
            return [
                'code' => $costCode->code, // Excel-safe formatting
                'description' => $costCode->description,
                'cost_type_code' => optional($costCode->costType)->code,
            ];
        })->toArray();
        // Add headers at the top
        array_unshift($costCodes, $headers);

        return response()->streamDownload(function () use ($costCodes) {
            $handle = fopen('php://output', 'w');
            foreach ($costCodes as $index => $row) {
                // Skip transformation for header row
                if ($index > 0 && isset($row['code'])) {
                    $row['code'] = '="'.$row['code'].'"';
                }
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
            [$code, $description, $costTypeCode] = $row;
            $costType = CostType::where('code', $costTypeCode)->first();

            $costCode = CostCode::updateOrCreate(
                ['code' => $code],
                [
                    'description' => $description,
                    'cost_type_id' => $costType ? $costType->id : null,
                ]
            );
        }

        fclose($handle);

        return redirect()->back()->with('success', 'Cost Codes imported successfully.');
    }

    public function destroy(CostCode $costcode)
    {
        $costcode->delete();

        return redirect()->back()->with('success', 'Cost Code deleted successfully.');
    }
}
