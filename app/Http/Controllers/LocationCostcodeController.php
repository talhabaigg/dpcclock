<?php

namespace App\Http\Controllers;

use App\Exports\CostCodeRatioExport;
use App\Models\CostCode;
use App\Models\Location;
use App\Services\PremierAuthenticationService;
use Http;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

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
            // Use sync() to match Premier exactly - removes codes not in the new data
            // Convert array format from [{location_id, cost_code_id}, ...] to [cost_code_id => [], ...]
            $syncData = collect($data)->mapWithKeys(function ($item) {
                return [$item['cost_code_id'] => []];
            })->toArray();

            $location->costCodes()->sync($syncData);

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
        $location = Location::findOrFail($locationId);
        $items = $location->costCodes()->orderBy('code')->get();

        $rows = $items->map(fn ($item) => [
            $location->external_id,
            $item->code,
            $item->description,
            $item->pivot->variation_ratio,
            $item->pivot->dayworks_ratio,
            $item->pivot->waste_ratio,
            $item->pivot->prelim_type,
        ])->toArray();

        $fileName = 'cost_code_ratios_'.$location->name.'_'.now()->format('Ymd_His').'.xlsx';

        return Excel::download(new CostCodeRatioExport($rows), $fileName);
    }

    public function upload(Request $request, Location $location)
    {
        $request->validate([
            'rows' => 'required|array|min:1',
            'rows.*.cost_code' => 'required|string',
            'rows.*.variation_ratio' => 'nullable|numeric',
            'rows.*.dayworks_ratio' => 'nullable|numeric',
            'rows.*.waste_ratio' => 'nullable|numeric',
            'rows.*.prelim_type' => 'nullable|string',
        ]);

        $updated = 0;

        foreach ($request->input('rows') as $data) {
            $costCode = CostCode::where('code', ltrim($data['cost_code'], "'"))->first();
            if ($costCode) {
                $location->costCodes()->syncWithoutDetaching([
                    $costCode->id => [
                        'variation_ratio' => floatval($data['variation_ratio'] ?? 0),
                        'dayworks_ratio' => floatval($data['dayworks_ratio'] ?? 0),
                        'waste_ratio' => floatval($data['waste_ratio'] ?? 0),
                        'prelim_type' => $data['prelim_type'] ?? null,
                    ],
                ]);
                $updated++;
            }
        }

        return back()->with('success', "Updated {$updated} cost code ratios successfully.");
    }
}
