<?php

namespace App\Http\Controllers;

use App\Models\CostCode;
use App\Models\Location;
use App\Services\PremierAuthenticationService;
use Http;
use Illuminate\Http\Request;
use Inertia\Inertia;

class LocationCostcodeController extends Controller
{
    public function sync(Location $location)
    {
        $authService = new PremierAuthenticationService;
        $token = $authService->getAccessToken();
        $company = [
            '1149031' => '07a4fde9-b0b9-413b-bd50-62f0d7a6f23d', // SWC
            '1198645' => 'deaca42a-4c52-4255-b97e-ef34ac82cdb7', // GREEN
            '1249093' => '3341c7c6-2abb-49e1-8a59-839d1bcff972', // SWCP
        ];
        $companyId = $company[$location->eh_parent_id] ?? null;
        $base_url = config('premier.swagger_api.base_url');
        $queryParams = [
            'parameter.companyId' => $companyId,      // Or hardcoded ID
            'parameter.jobNumber' => $location->external_id,      // Or 'ANU00'
            'parameter.pageSize' => 1000,
        ];
        $response = Http::withToken($token)
            ->acceptJson()
            ->get($base_url.'/api/Job/GetCostItems', $queryParams);
        $costCodes = CostCode::select('id', 'code')->get();
        if ($response->successful()) {
            $data = $response->json('Data');

            $data = collect($data)->map(function ($item) use ($costCodes, $location) {
                $costCode = $costCodes->firstWhere('code', $item['CostItemCode']);
                if ($costCode) {
                    return [
                        'location_id' => $location->id,
                        'cost_code_id' => $costCode->id,
                    ];
                }

                return null;
            })->filter()->values()->toArray();
            // dd($data);
            // $location->costCodes()->sync($data);
            // dd('synced');
            // Get existing cost codes for this location
            $existingIds = $location->costCodes()->pluck('cost_code_id')->toArray();

            // Filter out codes that already exist
            $newData = collect($data)->filter(fn ($item) => ! in_array($item['cost_code_id'], $existingIds))->values()->toArray();

            // Attach only the new ones
            if (! empty($newData)) {
                $location->costCodes()->attach($newData);
            }

            return redirect()->back()->with('success', 'Cost codes synced successfully.');
        } else {
            logger()->error('Failed to fetch cost items', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \Exception('Premier API call failed.');
        }
    }

    public function edit(Location $location)
    {
        $costCodes = $location->costCodes()->orderBy('code')->get();

        return Inertia::render('locations/costCodeEdit', [
            'location' => $location,
            'costCodes' => $costCodes,
        ]);
    }

    public function update(Location $location)
    {
        $data = request()->validate([
            'costCodes' => 'required|array',
            'costCodes.*.id' => 'required|exists:cost_codes,id',
            'costCodes.*.variation_ratio' => 'required|numeric|min:0 |max:200',
            'costCodes.*.dayworks_ratio' => 'required|numeric|min:0',
            'costCodes.*.waste_ratio' => 'nullable|numeric|min:0 |max:200',
            'costCodes.*.prelim_type' => 'nullable|string',
        ]);

        // Transform into the format sync() wants
        $syncData = collect($data['costCodes'])
            ->mapWithKeys(function ($code) {
                return [
                    $code['id'] => [
                        'variation_ratio' => $code['variation_ratio'],
                        'dayworks_ratio' => $code['dayworks_ratio'],
                        'waste_ratio' => $code['waste_ratio'],
                        'prelim_type' => $code['prelim_type'],
                    ],
                ];
            })
            ->toArray();

        $location->costCodes()->sync($syncData);

        return redirect()->back()->with('success', 'Cost codes updated successfully.');
    }

    public function delete(Location $location, $id)
    {
        $costCode = $location->costCodes()->find($id);
        if ($costCode) {
            $location->costCodes()->detach($costCode);

            return redirect()->back()->with('success', 'Cost code deleted successfully.');
        }

        return redirect()->back()->with('error', 'Cost code not found.');
    }

    public function downloadCostCodeRatios($locationId)
    {
        // $acceptable_prefixes = ['01', '02', '03', '04', '05', '06', '07', '08'];

        $location = Location::findOrFail($locationId);
        $fileName = 'location_cost_code_ratios_'.$location->name.'_'.now()->format('Ymd_His').'.csv';
        $filePath = storage_path("app/{$fileName}");

        $handle = fopen($filePath, 'w');
        fputcsv($handle, ['job_number', 'cost_code', 'description', 'variation_ratio', 'dayworks_ratio', 'waste_ratio', 'prelim_type']);
        $items = $location->costCodes()->get();

        // $filteredItems = $items->filter(function ($item) use ($acceptable_prefixes) {
        //     foreach ($acceptable_prefixes as $prefix) {
        //         if (str_starts_with($item->code, $prefix)) {
        //             return true;
        //         }
        //     }
        //     return false;
        // });

        $filteredItems = $items->sortBy('code');

        foreach ($filteredItems as $item) {
            fputcsv($handle, [
                $location->external_id,
                "'".$item->code, // 👈 prevents Excel auto-conversion
                $item->description,
                $item->pivot->variation_ratio,
                $item->pivot->dayworks_ratio,
            ]);
        }

        fclose($handle);

        return response()->download($filePath)->deleteFileAfterSend(true);
    }

    public function upload(Request $request, Location $location)
    {

        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);

        $path = $request->file('file')->getRealPath();
        $rows = array_map('str_getcsv', file($path));
        $header = array_map('trim', array_shift($rows));
        $dataToInsert = [];

        foreach ($rows as $row) {
            $data = array_combine($header, $row);
            $dataToInsert[] = $data;
        }
        // dd($dataToInsert);

        foreach ($dataToInsert as $data) {
            $costCode = CostCode::where('code', ltrim($data['cost_code'], "'"))->first();
            if ($costCode) {
                $location->costCodes()->syncWithoutDetaching([
                    $costCode->id => [
                        'variation_ratio' => floatval($data['variation_ratio']) ?? null,
                        'dayworks_ratio' => floatval($data['dayworks_ratio']) ?? null,
                        'waste_ratio' => floatval($data['waste_ratio']) ?? null,
                        'prelim_type' => $data['prelim_type'] ?? null,
                    ],
                ]);
            }
        }

        return back()->with('success', 'Uploaded cost code ratios successfully.');
    }
}
