<?php

namespace App\Http\Controllers;

use App\Models\MaterialItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use App\Models\Supplier;
use App\Models\CostCode;
use App\Models\Location;
use Illuminate\Support\Facades\DB;

class MaterialItemController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        // Fetch all material items with their cost codes
        $materialItems = MaterialItem::with('costCode', 'supplier')->get();


        return Inertia::render('materialItem/index', [
            'items' => $materialItems,
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(MaterialItem $materialItem)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(MaterialItem $materialItem)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, MaterialItem $materialItem)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(MaterialItem $materialItem)
    {
        //
    }

    public function upload(Request $request)
    {
        set_time_limit(300); // Extend request time to 5 minutes
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);
        $suppliers = Supplier::all()->keyBy(fn($s) => trim($s->code));
        $costCodes = CostCode::all()->keyBy(fn($c) => trim($c->code));
        $file = fopen($request->file('file')->getRealPath(), 'r');
        $header = fgetcsv($file); // Skip header row
        $missingCostCodeRows = [];
        while (($row = fgetcsv($file)) !== false) {
            [$code, $description, $unit_cost, $supplier_code, $costcode] = array_map('trim', $row);

            $supplier = $suppliers->get($supplier_code);
            $costCode = $costCodes->get($costcode);

            if (!$supplier || !$costCode) {
                $row[4] = '="' . $row[4] . '"'; // prevent Excel from formatting costcode
                $missingCostCodeRows[] = $row;
                continue;
            }

            MaterialItem::updateOrCreate(
                ['code' => $code],
                [
                    'description' => trim($description),
                    'unit_cost' => (float) $unit_cost,
                    'supplier_id' => $supplier->id,
                    'cost_code_id' => $costCode->id,
                ]
            );
        }
        fclose($file);

        if (!empty($missingCostCodeRows)) {
            $filename = 'missing_costcodes_' . now()->format('Ymd_His') . '.csv';
            $filePath = storage_path("app/{$filename}");

            $handle = fopen($filePath, 'w');
            foreach ($missingCostCodeRows as $missingRow) {
                fputcsv($handle, $missingRow);
            }
            fclose($handle);

            return redirect()->back()->with('success', json_encode($missingCostCodeRows));
        }

        return redirect()->back()->with('success', 'Material items imported successfully.');
    }

    public function download()
    {
        $fileName = 'material_items_' . now()->format('Ymd_His') . '.csv';
        $filePath = storage_path("app/{$fileName}");

        $handle = fopen($filePath, 'w');
        fputcsv($handle, ['code', 'description', 'unit_cost', 'supplier_code', 'cost_code']);

        $items = MaterialItem::with('supplier', 'costCode')->get();
        foreach ($items as $item) {
            fputcsv($handle, [
                $item->code,
                $item->description,
                $item->unit_cost,
                $item->supplier?->code,
                $item->costCode?->code,

            ]);
        }
        fclose($handle);

        return response()->download($filePath)->deleteFileAfterSend(true);
    }

    public function uploadLocationPricing(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);
        // dd($request->file('file'));

        $path = $request->file('file')->getRealPath();
        $rows = array_map('str_getcsv', file($path));
        $header = array_map('trim', array_shift($rows));
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);
        $insertCount = 0;
        foreach ($rows as $index => $row) {
            $data = array_combine($header, $row);

            $location = Location::where('external_id', $data['location_id'])->first();
            $material = MaterialItem::where('code', $data['code'])->first();

            if (!$location || !$material) {
                // You can log or skip
                continue;
            }

            DB::table('location_item_pricing')->updateOrInsert(
                [
                    'location_id' => $location->id,
                    'material_item_id' => $material->id,
                ],
                [
                    'unit_cost_override' => $data['unit_cost'],
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );

            $insertCount++;
        }

        return back()->with('success', "Imported $insertCount prices successfully.");
    }

    public function getMaterialItems(Request $request)
    {
        $supplierId = $request->input('supplier_id');

        $query = MaterialItem::query();

        // Wrap search + supplier filter inside the same where block
        if ($request->has('search') && $request->has('supplier_id')) {
            $search = $request->input('search');

            $query->where('supplier_id', $supplierId)
                ->where(function ($q) use ($search) {
                    $q->where('code', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
        } elseif ($request->has('supplier_id')) {
            // No search, just filter by supplier
            $query->where('supplier_id', $supplierId);
        }

        $materialItems = $query->limit(10)->get();

        return response()->json($materialItems);
    }

    public function getMaterialItemById($id, $locationId)
    {
        Log::info('Fetching material item with ID: ' . $id);
        Log::info('Fetching location with ID: ' . $locationId);

        // Fetch the item and its related cost code
        $item = MaterialItem::with('costCode')->find($id);

        // If no item is found, return 404 early
        if (!$item) {
            return response()->json(['message' => 'Item not found'], 404);
        }

        // Fetch the location-specific price (filtered in SQL)
        $location_price = DB::table('location_item_pricing')
            ->where('material_item_id', $id)
            ->where('location_id', $locationId)
            ->join('locations', 'location_item_pricing.location_id', '=', 'locations.id')
            ->select('locations.name as location_name', 'locations.id as location_id', 'location_item_pricing.unit_cost_override')
            ->first();

        Log::info('Location price fetched: ' . json_encode($location_price));

        if ($location_price) {
            $item->unit_cost = $location_price->unit_cost_override;
        }

        // Convert to array for response
        $itemArray = $item->toArray();
        $itemArray['price_list'] = $location_price ? $location_price->location_name : 'base_price';
        $itemArray['cost_code'] = $item->costCode ? $item->costCode->code : null;

        Log::info('Material item found: ' . json_encode($itemArray));

        return response()->json($itemArray);
    }

    public function getMaterialItemByCode($code, $locationId)
    {
        Log::info('Fetching material item with code: ' . $code);
        Log::info('Fetching location with ID: ' . $locationId);

        // Fetch the item and its related cost code
        $item = MaterialItem::with('costCode')->where('code', $code)->first();

        // If no item is found, return 404 early
        if (!$item) {
            return response()->json(['message' => 'Item not found'], 404);
        }

        // Fetch the location-specific price (filtered in SQL)
        $location_price = DB::table('location_item_pricing')
            ->where('material_item_id', $item->id)
            ->where('location_id', $locationId)
            ->join('locations', 'location_item_pricing.location_id', '=', 'locations.id')
            ->select('locations.name as location_name', 'locations.id as location_id', 'location_item_pricing.unit_cost_override')
            ->first();

        Log::info('Location price fetched: ' . json_encode($location_price));

        if ($location_price) {
            $item->unit_cost = $location_price->unit_cost_override;
        }

        // Convert to array for response
        $itemArray = $item->toArray();
        $itemArray['price_list'] = $location_price ? $location_price->location_name : 'base_price';
        $itemArray['cost_code'] = $item->costCode ? $item->costCode->code : null;

        Log::info('Material item found: ' . json_encode($itemArray));

        return response()->json($itemArray);
    }


}
