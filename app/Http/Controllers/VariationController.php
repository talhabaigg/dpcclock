<?php

namespace App\Http\Controllers;

use App\Jobs\LoadVariationsFromPremierJob;
use App\Models\CostCode;
use App\Models\Location;
use App\Models\Variation;
use App\Services\GetCompanyCodeService;
use App\Services\PremierAuthenticationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class VariationController extends Controller
{
    public function locationVariations(Location $location)
    {
        $location->load('variations.lineItems');

        foreach ($location->variations as $variation) {
            $location->total_variation_cost = $variation->lineItems->sum('total_cost');
            $location->total_variation_revenue = $variation->lineItems->sum('revenue');
        }

        foreach ($location->variations as $variation) {
            $variation->total_variation_cost = $variation->lineItems->sum('total_cost');
            $variation->total_variation_revenue = $variation->lineItems->sum('revenue');
        }

        return Inertia::render('variation/location-variations', [
            'location' => $location,
        ]);
    }

    public function loadVariationsFromPremier(Location $location)
    {
        LoadVariationsFromPremierJob::dispatch($location);

        return redirect()->back()->with('success', 'Variation sync job has been queued. Changes will appear shortly.');
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
        $user = auth()->user();
        $locationsQuery = Location::with([
            'costCodes.costType',
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

    public function edit($id)
    {
        $variation = Variation::with('lineItems', 'location')->findOrFail($id);
        $user = auth()->user();
        $locationsQuery = Location::with([
            'costCodes.costType',
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
        $costCodes = CostCode::with('costType')->orderBy('code')->get();

        return Inertia::render('variation/create', [
            'locations' => $locations,
            'costCodes' => $costCodes,
            'variation' => $variation,
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

        $lineItems = collect($validated['line_items'])->map(function ($item) {
            return [
                'line_number' => $item['line_number'],
                'cost_item' => $item['cost_item'],
                'cost_type' => $item['cost_type'],
                'description' => $item['description'],
                'qty' => 1,
                'unit_cost' => $item['total_cost'],
                'total_cost' => $item['total_cost'],
                'revenue' => $item['revenue'],
            ];
        })->toArray();

        $variation->lineItems()->createMany($lineItems);

        return redirect()->route('variations.index');
    }

    public function update(Request $request, Variation $variation)
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
            'line_items.*.qty' => 'required',
            'line_items.*.unit_cost' => 'required|numeric|min:0',
            'line_items.*.total_cost' => 'required|numeric|min:0',
            'line_items.*.revenue' => 'required|numeric|min:0',
        ]);

        $variation->update([
            'location_id' => $validated['location_id'],
            'type' => $validated['type'],
            'co_number' => $validated['co_number'],
            'description' => $validated['description'],

            'co_date' => $validated['date'],
        ]);

        $variation->lineItems()->delete();

        $lineItems = collect($validated['line_items'])->map(function ($item) {
            return [
                'line_number' => $item['line_number'],
                'cost_item' => $item['cost_item'],
                'cost_type' => $item['cost_type'],
                'description' => $item['description'],
                'qty' => 1,
                'unit_cost' => $item['total_cost'],
                'total_cost' => $item['total_cost'],
                'revenue' => $item['revenue'],
            ];
        })->toArray();

        $variation->lineItems()->createMany($lineItems);

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
        $companyService = new GetCompanyCodeService;
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
            'RFI',
        ];

        foreach ($variation->lineItems as $lineItem) {
            $csvData[] = [
                $companyCode,                           // Company Code (fill if needed)
                $variation->location->external_id ?? '', // Job Number
                $variation->co_number,        // CO Number
                $variation->description,      // Description
                $variation->co_date,          // CO Date
                '',                           // Internal CO
                '',                           // Extra Days
                $lineItem->line_number,       // Line
                '="'.$lineItem->cost_item.'"',         // Cost Item
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
                '',                            // RFI
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
        $authService = new PremierAuthenticationService;
        $token = $authService->getAccessToken();
        $companyId = '3341c7c6-2abb-49e1-8a59-839d1bcff972';
        $base_url = config('premier.swagger_api.base_url');
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
            ->post($base_url.'/api/ChangeOrder/CreateChangeOrders', $data);
        if ($response->successful()) {
            $variation->status = 'sent';
            $variation->save();
            Log::info('Variation sent to Premier successfully.', $response->json());

            return redirect()->back()->with('success', 'Variation sent to Premier successfully.');
        } else {
            Log::error('Failed to send variation to Premier.', [
                'response' => $response->
                    json(),
            ]);

            return redirect()->back()->with('error', 'Failed to send variation to Premier.');
        }
    }

    public function duplicate(Variation $variation)
    {
        $newVariation = $variation->replicate();
        $newVariation->co_number = $variation->co_number.'-COPY';
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
