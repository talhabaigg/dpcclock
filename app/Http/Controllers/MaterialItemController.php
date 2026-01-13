<?php

namespace App\Http\Controllers;

use App\Exports\MaterialItemExport;
use App\Models\MaterialItem;
use App\Models\MaterialItemPriceListUpload;
use Cache;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use App\Models\Supplier;
use App\Models\CostCode;
use App\Models\Location;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use Spatie\Activitylog\Models\Activity;

use Validator;

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
        return Inertia::render('materialItem/edit', [
            'item' => null,
            'costCodes' => CostCode::all(),
            'suppliers' => Supplier::all(),
            'maxItems' => MaterialItem::count(),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $request->validate([
            'code' => 'required|string|max:255',
            'description' => 'required|string|max:255',
            'unit_cost' => 'required|numeric|min:0',
            'cost_code_id' => 'nullable|exists:cost_codes,id',
            'supplier_id' => 'nullable|exists:suppliers,id',
        ]);

        MaterialItem::create([
            'code' => $request->input('code'),
            'description' => $request->input('description'),
            'unit_cost' => $request->input('unit_cost'),
            'cost_code_id' => $request->input('cost_code_id'),
            'supplier_id' => $request->input('supplier_id'),
        ]);

        return redirect()->route('material-items.index')->with('success', 'Material item created successfully.');
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
        if (!$materialItem->exists) {
            return redirect()->route('material-items.index')->with('error', 'Material item not found.');
        }
        $item = $materialItem->load('costCode', 'supplier', 'orderHistory.requisition.location');
        // dd($item);
        $activities = Activity::query()
            ->with('causer')
            ->where('subject_type', MaterialItem::class)
            ->where('subject_id', $materialItem->id)
            ->when(request()->has('activity_type'), function ($query) {
                $query->where('description', request()->input('activity_type'));
            })
            ->orderBy('id', 'desc')
            ->get();

        // dd($activities);
        $maxItems = MaterialItem::count();
        return Inertia::render('materialItem/edit', [
            'item' => $item,
            'costCodes' => CostCode::all(),
            'suppliers' => Supplier::all(),
            'maxItems' => $maxItems,
            'activities' => $activities,

        ]);
    }


    public function next(MaterialItem $materialItem)
    {
        $nextItem = MaterialItem::where('id', '>', $materialItem->id)->first();
        if ($nextItem) {
            return redirect()->route('material-items.edit', ['materialItem' => $nextItem->id]);
        }
        $firstItem = MaterialItem::orderBy('id', 'asc')->first();
        if ($firstItem) {
            return redirect()->route('material-items.edit', ['materialItem' => $firstItem->id]);
        }

        // If there are no items at all
        return redirect()->route('material-items.index')->with('success', 'No items available to edit.');
    }

    public function previous(MaterialItem $materialItem)
    {
        // Try to get the previous item (with smaller ID)
        $previousItem = MaterialItem::where('id', '<', $materialItem->id)
            ->orderBy('id', 'desc')
            ->first();

        // If found, redirect to edit that item
        if ($previousItem) {
            return redirect()->route('material-items.edit', ['materialItem' => $previousItem->id]);
        }

        // If not found, loop to the item with the highest ID
        $lastItem = MaterialItem::orderBy('id', 'desc')->first();
        if ($lastItem) {
            return redirect()->route('material-items.edit', ['materialItem' => $lastItem->id]);
        }

        // If there are no items at all
        return redirect()->route('material-items.index')->with('success', 'No items available to edit.');
    }
    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, MaterialItem $materialItem)
    {
        $request->validate([
            'code' => 'required|string|max:255',
            'description' => 'required|string|max:255',
            'unit_cost' => 'required|numeric|min:0',
            'cost_code_id' => 'nullable|exists:cost_codes,id',
            'supplier_id' => 'nullable|exists:suppliers,id',
        ]);

        $materialItem->update([
            'code' => $request->input('code'),
            'description' => $request->input('description'),
            'unit_cost' => $request->input('unit_cost'),
            'cost_code_id' => $request->input('cost_code_id'),
            'supplier_id' => $request->input('supplier_id'),

        ]);

        return redirect()->back()->with('success', 'Material item updated successfully.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(MaterialItem $materialItem)
    {
        $materialItem->delete();
        return redirect()->route('material-items.index')->with('success', 'Material item deleted successfully.');
    }

    public function destroyMultiple(Request $request)
    {
        $ids = Validator::make($request->all(), [
            'ids' => 'required|array',
            'ids.*' => 'exists:material_items,id',
        ])->validate()['ids'];

        MaterialItem::whereIn('id', $ids)->delete();
        return redirect()->route('material-items.index');
        ;
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
                ['code' => $code, 'supplier_id' => $supplier->id],
                [
                    'description' => trim($description),
                    'unit_cost' => (float) $unit_cost,
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
        $fileName = 'material_items_' . now()->format('Ymd_His') . '.xlsx';
        return Excel::download(new MaterialItemExport(), $fileName);
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
        $uploaded_fileName = 'location_pricing_upload_' . now()->format('Ymd_His') . '.csv';

        $original_file_uploaded = Storage::disk('s3')->put('location_pricing/uploads/' . $uploaded_fileName, file_get_contents($request->file('file')->getRealPath()));
        if (!$original_file_uploaded) {
            return back()->with('error', 'Failed to upload file to S3.');
        }
        $path = $request->file('file')->getRealPath();
        $rows = array_map('str_getcsv', file($path));
        $header = array_map('trim', array_shift($rows));
        $stats = [
            'total' => 0,
            'failed' => 0,
            'empty' => 0,
            'malformed' => 0,
            'duplicate' => 0,
        ];
        $seen = [];
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);

        $dataToInsert = [];
        $locationIds = [];
        $failedRows = [];
        $locationsData = Location::select('id', 'external_id')->get()->keyBy('external_id');
        $materials = MaterialItem::select('id', 'code')->get()->keyBy('code');
        foreach ($rows as $row) {
            if (count($row) === 1 && trim((string) $row[0]) === '') {
                $stats['empty']++;
                continue;
            }

            $stats['total']++;

            // malformed: columns don't match header
            if (count($row) !== count($header)) {
                $stats['malformed']++;
                $failedRows[] = $row; // or enrich with reason
                continue;
            }
            $data = array_combine($header, $row);

            $location = $locationsData->get($data['location_id']);
            $material = $materials->get($data['code']);

            if (!$location || !$material) {
                $stats['failed']++;
                $failedRows[] = $row;
                continue;
            }

            $key = $location->id . '-' . $material->id;
            if (isset($seen[$key])) {
                $stats['duplicate']++;
                continue;
            }
            $seen[$key] = true;
            $locationIds[] = $location->id;

            $dataToInsert[] = [
                'location_id' => $location->id,
                'material_item_id' => $material->id,
                'unit_cost_override' => floatval($data['unit_cost']),
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        $uniqueLocationIds = array_unique($locationIds);
        $dataToInsert = collect($dataToInsert)
            ->unique(fn($item) => $item['location_id'] . '-' . $item['material_item_id'])
            ->values()
            ->toArray();
        DB::transaction(function () use ($uniqueLocationIds, $dataToInsert) {
            // Delete old pricing only for relevant locations
            DB::table('location_item_pricing')
                ->whereIn('location_id', $uniqueLocationIds)
                ->delete();

            // Insert new pricing
            DB::table('location_item_pricing')->insert($dataToInsert);
        });

        if (!empty($failedRows)) {
            $filename = 'failed_location_pricing_' . now()->format('Ymd_His') . '.csv';
            $filePath = storage_path("app/{$filename}");

            $handle = fopen($filePath, 'w');
            fputcsv($handle, $header);
            foreach ($failedRows as $failedRow) {
                fputcsv($handle, $failedRow);
            }
            fclose($handle);

            // Save the file to S3
            $s3Path = "location_pricing/failed/{$filename}";
            \Storage::disk('s3')->put($s3Path, file_get_contents($filePath));

            // Delete the local file after uploading to S3
            unlink($filePath);

            $s3Url = \Storage::disk('s3')->url($s3Path);
            $priceList = MaterialItemPriceListUpload::create([
                'location_id' => $location->id,
                'upload_file_path' => 'location_pricing/uploads/' . $uploaded_fileName,
                'failed_file_path' => "location_pricing/failed/{$filename}",
                'status' => 'success',
                'total_rows' => count($rows),
                'processed_rows' => count($dataToInsert),
                'failed_rows' => count($failedRows),
                'created_by' => auth()->id(),
            ]);
            return back()->with('success', "Imported " . count($dataToInsert) . " prices successfully. Some rows failed to import. Download the failed rows <a href='{$s3Url}'>here</a>.");
        }

        $priceList = MaterialItemPriceListUpload::create([
            'location_id' => $location->id,
            'upload_file_path' => 'location_pricing/uploads/' . $uploaded_fileName,
            'failed_file_path' => null,
            'status' => 'success',
            'total_rows' => $stats['total'],
            'processed_rows' => count($dataToInsert),
            'failed_rows' => $stats['failed'] + $stats['malformed'], // depending how you want it
            'created_by' => auth()->id(),
        ]);
        if (!$priceList) {
            Log::error('Failed to create MaterialItemPriceListUpload record for file: ' . $uploaded_fileName);
        }


        return back()->with('success', "Imported " . count($dataToInsert) . " prices successfully.");
    }

    private function uploadFileToS3($filePath, $s3Path)
    {
        $uploaded = Storage::put($s3Path, file_get_contents($filePath));
        return $uploaded;
    }

    public function downloadLocationPricingListCSV($locationId)
    {
        $location = Location::findOrFail($locationId);
        $fileName = 'location_pricing_' . $location->name . '_' . now()->format('Ymd_His') . '.csv';
        $filePath = storage_path("app/{$fileName}");

        $handle = fopen($filePath, 'w');
        fputcsv($handle, ['location_id', 'code', 'unit_cost']);

        $items = DB::table('location_item_pricing')
            ->where('location_id', $location->id)
            ->join('material_items', 'location_item_pricing.material_item_id', '=', 'material_items.id')
            ->select('location_item_pricing.location_id', 'material_items.code', 'location_item_pricing.unit_cost_override')
            ->get();
        foreach ($items as $item) {
            fputcsv($handle, [
                $location->external_id,
                $item->code,
                $item->unit_cost_override,
            ]);
        }
        fclose($handle);

        return response()->download($filePath)->deleteFileAfterSend(true);
    }

    public function downloadLocationPricingListExcel($locationId)
    {
        $location = Location::findOrFail($locationId);
        $fileName = 'location_pricing_' . $location->name . '_' . now()->format('Ymd_His') . '.xlsx';
        $filePath = storage_path("app/{$fileName}");

        $items = DB::table('location_item_pricing')
            ->where('location_id', $location->id)
            ->join('material_items', 'location_item_pricing.material_item_id', '=', 'material_items.id')
            ->join('suppliers', 'material_items.supplier_id', '=', 'suppliers.id')
            ->select('location_item_pricing.location_id', 'material_items.code', 'location_item_pricing.unit_cost_override', 'suppliers.code as supplier_code')
            ->get()
            ->toArray();

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Location Pricing');

        // Set header
        $sheet->setCellValue('A1', 'location_id');
        $sheet->setCellValue('B1', 'code');
        $sheet->setCellValue('C1', 'unit_cost');
        $sheet->setCellValue('D1', 'supplier_code');

        // Populate data
        $rowNumber = 2;
        foreach ($items as $item) {
            $sheet->setCellValue('A' . $rowNumber, $location->external_id);
            $sheet->setCellValue('B' . $rowNumber, $item->code);
            $sheet->setCellValue('C' . $rowNumber, $item->unit_cost_override);
            $sheet->setCellValue('D' . $rowNumber, $item->supplier_code);
            $rowNumber++;
        }

        $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
        $writer->save($filePath);

        return response()->download($filePath)->deleteFileAfterSend(true);
    }

    public function getMaterialItems(Request $request)
    {
        $supplierId = $request->input('supplier_id');
        $locationId = $request->input('location_id');
        $search = $request->input('search');

        // Build cache key (unique per filter combination)
        $cacheKey = "material_items:supplier_{$supplierId}:location_{$locationId}:search_" . md5($search ?? '');

        return Cache::remember($cacheKey, now()->addMinutes(5), function () use ($supplierId, $locationId, $search) {
            $query = MaterialItem::query()
                ->select('material_items.id', 'material_items.code', 'material_items.description');

            // Supplier filter
            if ($supplierId) {
                $query->where('supplier_id', $supplierId);
            }

            // Search filter
            if ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('code', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            }

            // Favourites handling
            if ($locationId) {
                $query->leftJoin('location_favourite_materials as favs', function ($join) use ($locationId) {
                    $join->on('favs.material_item_id', '=', 'material_items.id')
                        ->where('favs.location_id', '=', $locationId);
                })
                    ->addSelect(DB::raw('CASE WHEN favs.id IS NULL THEN 0 ELSE 1 END as is_favourite'));

                // Only apply ordering if search is NOT provided
                if (!$search) {
                    $query->orderByDesc('is_favourite');
                }
            }

            return $query->limit(100)->get();
        });
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
