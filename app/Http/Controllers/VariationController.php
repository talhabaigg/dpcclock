<?php

namespace App\Http\Controllers;

use App\Models\CostCode;
use App\Models\Location;
use App\Models\Variation;
use App\Services\GetCompanyCodeService;
use App\Services\PremierAuthenticationService;
use App\Services\VariationService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class VariationController extends Controller
{
    public function locationVariations(Location $location)
    {
        $location->load('variations.lineItems');


        foreach ($location->variations as $variation) {
            $location->total_variation_cost = $variation->lineItems->sum('total_cost');
            $location->total_variation_revenue = $variation->lineItems->sum('revenue');
        }


        return Inertia::render('variation/location-variations', [
            'location' => $location,
        ]);
    }

    public function loadVariationsFromPremier(Location $location)
    {
        $authService = new PremierAuthenticationService();
        $token = $authService->getAccessToken();
        $companyService = new GetCompanyCodeService();
        $companyId = $companyService->getCompanyCode($location->eh_parent_id);

        $variationService = new VariationService();
        $response = $variationService->getChangeOrders($location, $companyId, $token);
        if ($response->ok()) {
            $data = $response->json('Data');
            foreach ($data as $item) {
                $variation = Variation::updateOrCreate(
                    [
                        'co_number' => $item['ChangeOrderNumber'],
                    ],
                    [
                        'location_id' => $location->id,
                        'type' => $item['ChangeTypeCode'] ?? 'N/A',
                        'description' => $item['Description'],
                        'co_date' => $item['CODate'],
                        'status' => $item['COStatus'],
                    ]
                );

                $lines = $variationService->getChangeOrderLines($item['ChangeOrderID'], $companyId, $token);
                if ($lines->ok()) {
                    $lineData = $lines->json('Data');
                    Log::info('Line Data:', $lineData);
                }
            }
        } else {
            Log::error('Failed to fetch variations from Premier', [
                'response' => $response->json(),
            ]);


            return redirect()
                ->back()
                ->with('error', [
                    'message' => 'Failed to fetch variations from Premier.',
                    'response' => is_array($response->json()) || is_object($response->json())
                        ? json_encode($response->json(), JSON_PRETTY_PRINT)
                        : $response->json(),
                ]);
        }

        return redirect()->back()->with('success', 'Variations synced from Premier successfully.');

    }
    public function index()
    {
        $variations = Variation::with('lineItems', 'location')->get();

        foreach ($variations as $variation) {
            $variation->total_cost = $variation->lineItems->sum('total_cost');
            $variation->total_revenue = $variation->lineItems->sum('revenue');
        }
        // Logic to retrieve variations
        return Inertia::render('variation/index', [
            'variations' => $variations,
        ]);
    }

    public function create()
    {
        $acceptable_prefixes = ['01', '02', '03', '04', '05', '06', '07', '08'];

        $user = auth()->user();
        $locationsQuery = Location::with([
            'costCodes' => function ($query) use ($acceptable_prefixes) {
                $query->where(function ($q) use ($acceptable_prefixes) {
                    foreach ($acceptable_prefixes as $prefix) {
                        $q->orWhere('code', 'like', $prefix . '%');
                    }
                });
            }
        ])->where(function ($query) {
            $query->where('eh_parent_id', 1149031)
                ->orWhere('eh_parent_id', 1249093)
                ->orWhere('eh_parent_id', 1198645);
        });

        if ($user->hasRole('manager')) {
            $ehLocationIds = $user->managedKiosks()->pluck('eh_location_id');
            $locationsQuery->whereIn('eh_location_id', $ehLocationIds);
        }

        $locations = $locationsQuery->get();
        // dd($locations);


        $costCodes = CostCode::with('costType')->orderBy('code')->get();
        // Logic to show the create variation form
        return Inertia::render('variation/create', [
            'locations' => $locations,
            'costCodes' => $costCodes,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'location_id' => 'required|exists:locations,id',
            'type' => 'required|string',
            'co_number' => 'required|string',
            'description' => 'required|string',

            'date' => 'required|date',
            'line_items' => 'required|array',
            'line_items.*.line_number' => 'required',
            'line_items.*.cost_item' => 'required|string',
            'line_items.*.cost_type' => 'required|string',
            'line_items.*.description' => 'required|string',
            'line_items.*.qty' => 'required|integer|min:1',
            'line_items.*.unit_cost' => 'required|numeric|min:0',
            'line_items.*.total_cost' => 'required|numeric|min:0',
            'line_items.*.revenue' => 'required|numeric|min:0',
        ]);


        $variation = Variation::create([
            'location_id' => $validated['location_id'],
            'type' => $validated['type'],
            'co_number' => $validated['co_number'],
            'description' => $validated['description'],

            'co_date' => $validated['date'],
        ]);

        $variation->lineItems()->createMany($validated['line_items']);

        return redirect()->route('variations.index');
    }

    public function destroy($id)
    {
        $variation = Variation::findOrFail($id);
        $variation->delete();

        return redirect()->route('variations.index')->with('success', 'Variation deleted successfully.');
    }

    public function download($id)
    {

        $variation = Variation::with('lineItems')->findOrFail($id);
        $companyService = new GetCompanyCodeService();
        $companyCode = $companyService->getCompanyCode($variation->location->eh_parent_id);

        // CSV Header
        $csvData = [];
        $csvData[] = [
            'Company Code',
            'Job Number',
            'CO Number',
            'Description',
            'CO Date',
            'Internal CO',
            'Extra Days',
            'Line',
            'Cost Item',
            'Cost Type',
            'Department',
            'Location',
            'Line Description',
            'UofM',
            'Qty',
            'Unit Cost',
            'Cost',
            'Revenue',
            'Vendor Name',
            'Subcontract',
            'PO',
            'Memo',
            'RFI'
        ];

        foreach ($variation->lineItems as $lineItem) {
            $csvData[] = [
                $companyCode,                           // Company Code (fill if needed)
                $variation->location->external_id ?? '',// Job Number
                $variation->co_number,        // CO Number
                $variation->description,      // Description
                $variation->co_date,          // CO Date
                '',                           // Internal CO
                '',                           // Extra Days
                $lineItem->line_number,       // Line
                '="' . $lineItem->cost_item . '"',         // Cost Item
                $lineItem->cost_type,
                '',                             // Department
                '',                           // Location
                $lineItem->description,       // Line Description
                '',                           // UofM
                $lineItem->qty,               // Qty
                $lineItem->unit_cost,         // Unit Cost
                $lineItem->total_cost,        // Cost
                $lineItem->revenue > 0 ? $lineItem->revenue : '',           // Revenue
                '',                           // Vendor Name
                '',                           // Subcontract
                '',                           // PO
                '',                           // Memo
                ''                            // RFI
            ];
        }

        $filename = "variation_{$variation->id}.csv";
        header('Content-Type: text/csv');
        header("Content-Disposition: attachment; filename={$filename}");

        $handle = fopen('php://output', 'w');

        foreach ($csvData as $row) {
            fputcsv($handle, $row);
        }

        fclose($handle);
        exit;
    }

    // public function LoadVariationsFromPremier()
    // {
    //     Log::info('LoadVariationsFromPremier called');
    //     $authService = new PremierAuthenticationService();
    //     $token = $authService->getAccessToken();
    //     $companyId = '3341c7c6-2abb-49e1-8a59-839d1bcff972';
    //     $base_url = env('PREMIER_SWAGGER_API_URL');

    //     $jobNumber = 'QTMP00';
    //     $queryParams = [
    //         'parameter.company' => $companyId,

    //         'parameter.pageSize' => 1000,
    //     ];
    //     $response = Http::withToken($token)
    //         ->acceptJson()
    //         ->get($base_url . '/api/ChangeOrder/GetChangeOrders', $queryParams);
    //     Log::info('response', $response->json());
    //     if ($response->successful()) {
    //         $data = $response->json('Data');
    //         Log::info('Premier Variations Data:', $data);
    //         dd($data);
    //     }
    //     return redirect()->back()->with('error', 'Failed to fetch variations from Premier');

    // }

    public function sendToPremier(Variation $variation)
    {
        $authService = new PremierAuthenticationService();
        $token = $authService->getAccessToken();
        $companyId = '3341c7c6-2abb-49e1-8a59-839d1bcff972';
        $base_url = env('PREMIER_SWAGGER_API_URL');
        // dd($variation->co_date);
        $lineItems = $variation->lineItems->map(function ($item) {
            return [
                'LineNumber' => $item->line_number,
                'JobCostItem' => $item->cost_item,
                'JobCostType' => $item->cost_type,
                'LineDescription' => $item->description,
                'Quantity' => $item->qty,
                'UnitCost' => $item->unit_cost,
                'Amount' => $item->total_cost,
            ];
        })->toArray();

        $data = [
            // Construct the data payload as per Premier's API requirements
            'Company' => $companyId,
            'JobSubledger' => 'SWCJOB',
            'Job' => $variation->location->external_id,
            'ChangeOrderNumber' => $variation->co_number,
            'Description' => $variation->description,
            'ChangeOrderDate' => $variation->co_date,
            'ChangeOrderLines' => $lineItems,
        ];

        $response = Http::withToken($token)
            ->acceptJson()
            ->post($base_url . '/api/ChangeOrder/CreateChangeOrders', $data);
        if ($response->successful()) {
            $variation->status = "sent";
            $variation->save();
            Log::info('Variation sent to Premier successfully.', $response->json());
            return redirect()->back()->with('success', 'Variation sent to Premier successfully.');
        } else {
            Log::error('Failed to send variation to Premier.', [
                'response' => $response->
                    json()
            ]);
            return redirect()->back()->with('error', 'Failed to send variation to Premier.');
        }
    }

    public function duplicate(Variation $variation)
    {
        $newVariation = $variation->replicate();
        $newVariation->co_number = $variation->co_number . '-COPY';
        $newVariation->status = 'pending';
        $newVariation->save();

        foreach ($variation->lineItems as $lineItem) {
            $newLineItem = $lineItem->replicate();
            $newLineItem->variation_id = $newVariation->id;
            $newLineItem->save();
        }

        return redirect()->route('variations.index')->with('success', 'Variation duplicated successfully.');
    }

}
