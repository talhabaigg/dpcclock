<?php

namespace App\Http\Controllers;

use App\Models\CostCode;
use Http;
use Illuminate\Http\Request;
use App\Models\Location;
use App\Services\PremierAuthenticationService;
use Inertia\Inertia;
class LocationCostcodeController extends Controller
{
    public function sync(Location $location)
    {
        $authService = new PremierAuthenticationService();
        $token = $authService->getAccessToken();
        $company = [
            '1149031' => '07a4fde9-b0b9-413b-bd50-62f0d7a6f23d', //SWC
            '1198645' => 'deaca42a-4c52-4255-b97e-ef34ac82cdb7', //GREEN
            '1249093' => '3341c7c6-2abb-49e1-8a59-839d1bcff972', //SWCP
        ];
        $companyId = $company[$location->eh_parent_id] ?? null;
        $base_url = env('PREMIER_SWAGGER_API_URL');
        $queryParams = [
            'parameter.companyId' => $companyId,      // Or hardcoded ID
            'parameter.jobNumber' => $location->external_id,      // Or 'ANU00'
            'parameter.pageSize' => 1000,
        ];
        $response = Http::withToken($token)
            ->acceptJson()
            ->get($base_url . '/api/Job/GetCostItems', $queryParams);
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
            $location->costCodes()->sync($data);
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

    public function delete(Location $location, $id)
    {
        $costCode = $location->costCodes()->find($id);
        if ($costCode) {
            $location->costCodes()->detach($costCode);
            return redirect()->back()->with('success', 'Cost code deleted successfully.');
        }
        return redirect()->back()->with('error', 'Cost code not found.');
    }
}
