<?php

namespace App\Http\Controllers;

use App\Models\CostCode;
use App\Models\Location;
use App\Models\Variation;
use App\Services\GetCompanyCodeService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class VariationController extends Controller
{
    public function index()
    {
        $variations = Variation::with('lineItems')->get();
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


        $costCodes = CostCode::orderBy('code')->get();
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

}
