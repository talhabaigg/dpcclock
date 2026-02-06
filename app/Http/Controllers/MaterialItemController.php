<?php

namespace App\Http\Controllers;

use App\Exports\MaterialItemExport;
use App\Models\CostCode;
use App\Models\Location;
use App\Models\MaterialItem;
use App\Models\Supplier;
use App\Models\SupplierCategory;
use Cache;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
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
        // Fetch all material items with their cost codes and categories
        $materialItems = MaterialItem::with('costCode', 'supplier', 'supplierCategory')->get();
        $categories = SupplierCategory::with('supplier')->get();

        return Inertia::render('materialItem/index', [
            'items' => $materialItems,
            'categories' => $categories,
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
            'categories' => SupplierCategory::with('supplier')->get(),
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
            'price_expiry_date' => 'nullable|date',
            'cost_code_id' => 'nullable|exists:cost_codes,id',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'supplier_category_id' => 'nullable|exists:supplier_categories,id',
        ]);

        MaterialItem::create([
            'code' => $request->input('code'),
            'description' => $request->input('description'),
            'unit_cost' => $request->input('unit_cost'),
            'price_expiry_date' => $request->input('price_expiry_date'),
            'cost_code_id' => $request->input('cost_code_id'),
            'supplier_id' => $request->input('supplier_id'),
            'supplier_category_id' => $request->input('supplier_category_id'),
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
        if (! $materialItem->exists) {
            return redirect()->route('material-items.index')->with('error', 'Material item not found.');
        }
        $item = $materialItem->load('costCode', 'supplier', 'supplierCategory', 'orderHistory.requisition.location');
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
            'categories' => SupplierCategory::with('supplier')->get(),
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
            'price_expiry_date' => 'nullable|date',
            'cost_code_id' => 'nullable|exists:cost_codes,id',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'supplier_category_id' => 'nullable|exists:supplier_categories,id',
        ]);

        $materialItem->update([
            'code' => $request->input('code'),
            'description' => $request->input('description'),
            'unit_cost' => $request->input('unit_cost'),
            'price_expiry_date' => $request->input('price_expiry_date') ?: null,
            'cost_code_id' => $request->input('cost_code_id'),
            'supplier_id' => $request->input('supplier_id'),
            'supplier_category_id' => $request->input('supplier_category_id') ?: null,
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
    }

    /**
     * Update the category of a material item (inline edit from AG Grid)
     */
    public function updateCategory(Request $request, MaterialItem $materialItem)
    {
        $request->validate([
            'supplier_category_id' => 'nullable|exists:supplier_categories,id',
        ]);

        $materialItem->update([
            'supplier_category_id' => $request->input('supplier_category_id'),
        ]);

        return response()->json(['success' => true, 'message' => 'Category updated successfully.']);
    }

    public function upload(Request $request)
    {
        set_time_limit(300); // Extend request time to 5 minutes
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);
        $suppliers = Supplier::all()->keyBy(fn ($s) => trim($s->code));
        $costCodes = CostCode::all()->keyBy(fn ($c) => trim($c->code));
        $supplierCategories = SupplierCategory::all()->keyBy(fn ($c) => trim($c->code));
        $file = fopen($request->file('file')->getRealPath(), 'r');
        $header = fgetcsv($file); // Skip header row
        $missingCostCodeRows = [];
        while (($row = fgetcsv($file)) !== false) {
            $row = array_map('trim', $row);
            $code = $row[0] ?? '';
            $description = $row[1] ?? '';
            $unit_cost = $row[2] ?? 0;
            $supplier_code = $row[3] ?? '';
            $costcode = $row[4] ?? '';
            $expiry_date = $row[5] ?? null;
            $category_code = $row[6] ?? null;

            $supplier = $suppliers->get($supplier_code);
            $costCode = $costCodes->get($costcode);

            if (! $supplier || ! $costCode) {
                $row[4] = '="'.$row[4].'"'; // prevent Excel from formatting costcode
                $missingCostCodeRows[] = $row;

                continue;
            }

            // Parse expiry date if provided
            $parsedExpiryDate = null;
            if (! empty($expiry_date)) {
                try {
                    $parsedExpiryDate = \Carbon\Carbon::parse($expiry_date)->format('Y-m-d');
                } catch (\Exception $e) {
                    // Invalid date format, leave as null
                    $parsedExpiryDate = null;
                }
            }

            // Find category by code (must also match supplier)
            $supplierCategoryId = null;
            if (! empty($category_code)) {
                $category = $supplierCategories->get($category_code);
                if ($category && $category->supplier_id === $supplier->id) {
                    $supplierCategoryId = $category->id;
                }
            }

            MaterialItem::updateOrCreate(
                ['code' => $code, 'supplier_id' => $supplier->id],
                [
                    'description' => trim($description),
                    'unit_cost' => (float) $unit_cost,
                    'cost_code_id' => $costCode->id,
                    'price_expiry_date' => $parsedExpiryDate,
                    'supplier_category_id' => $supplierCategoryId,
                ]
            );
        }
        fclose($file);

        if (! empty($missingCostCodeRows)) {
            $filename = 'missing_costcodes_'.now()->format('Ymd_His').'.csv';
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
        $fileName = 'material_items_'.now()->format('Ymd_His').'.xlsx';

        return Excel::download(new MaterialItemExport, $fileName);
        $fileName = 'material_items_'.now()->format('Ymd_His').'.csv';
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

        $uploaded_fileName = 'location_pricing_upload_'.now()->format('Ymd_His').'.csv';

        Log::info('MaterialItemController: Starting location pricing upload', [
            'file_name' => $uploaded_fileName,
            'user_id' => auth()->id(),
            'original_file_name' => $request->file('file')->getClientOriginalName(),
        ]);

        try {
            // Upload original file to S3
            $original_file_uploaded = Storage::disk('s3')->put(
                'location_pricing/uploads/'.$uploaded_fileName,
                file_get_contents($request->file('file')->getRealPath())
            );

            if (! $original_file_uploaded) {
                Log::error('MaterialItemController: Failed to upload file to S3', [
                    'file_name' => $uploaded_fileName,
                ]);

                return back()->with('error', 'Failed to upload file to S3.');
            }

            Log::info('MaterialItemController: File uploaded to S3 successfully', [
                'file_name' => $uploaded_fileName,
                's3_path' => 'location_pricing/uploads/'.$uploaded_fileName,
            ]);

            // Save temporary local copy for job processing
            $tempPath = storage_path('app/temp/'.$uploaded_fileName);

            // Create temp directory if it doesn't exist
            if (! file_exists(storage_path('app/temp'))) {
                mkdir(storage_path('app/temp'), 0755, true);
            }

            copy($request->file('file')->getRealPath(), $tempPath);

            Log::info('MaterialItemController: Dispatching UploadLocationPricingJob', [
                'file_name' => $uploaded_fileName,
                'temp_path' => $tempPath,
            ]);

            // Dispatch the job
            \App\Jobs\UploadLocationPricingJob::dispatch(
                $tempPath,
                $uploaded_fileName,
                auth()->id()
            );

            Log::info('MaterialItemController: Job dispatched successfully', [
                'file_name' => $uploaded_fileName,
            ]);

            return back()->with('success', 'File uploaded successfully and is being processed. You will be notified when the import is complete.');

        } catch (\Exception $e) {
            Log::error('MaterialItemController: Error during upload', [
                'file_name' => $uploaded_fileName,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->with('error', 'An error occurred during file upload: '.$e->getMessage());
        }
    }

    private function uploadFileToS3($filePath, $s3Path)
    {
        $uploaded = Storage::put($s3Path, file_get_contents($filePath));

        return $uploaded;
    }

    public function downloadLocationPricingListCSV($locationId)
    {
        $location = Location::findOrFail($locationId);
        $fileName = 'location_pricing_'.$location->name.'_'.now()->format('Ymd_His').'.csv';
        $filePath = storage_path("app/{$fileName}");

        $handle = fopen($filePath, 'w');
        fputcsv($handle, ['location_id', 'code', 'unit_cost', 'is_locked']);

        $items = DB::table('location_item_pricing')
            ->where('location_id', $location->id)
            ->join('material_items', 'location_item_pricing.material_item_id', '=', 'material_items.id')
            ->select('location_item_pricing.location_id', 'material_items.code', 'location_item_pricing.unit_cost_override', 'location_item_pricing.is_locked')
            ->get();
        foreach ($items as $item) {
            fputcsv($handle, [
                $location->external_id,
                $item->code,
                $item->unit_cost_override,
                $item->is_locked ? 'true' : 'false',
            ]);
        }
        fclose($handle);

        return response()->download($filePath)->deleteFileAfterSend(true);
    }

    public function downloadLocationPricingListExcel($locationId)
    {
        $location = Location::findOrFail($locationId);
        $fileName = 'location_pricing_'.$location->name.'_'.now()->format('Ymd_His').'.xlsx';
        $filePath = storage_path("app/{$fileName}");

        $items = DB::table('location_item_pricing')
            ->where('location_id', $location->id)
            ->join('material_items', 'location_item_pricing.material_item_id', '=', 'material_items.id')
            ->join('suppliers', 'material_items.supplier_id', '=', 'suppliers.id')
            ->select('location_item_pricing.location_id', 'material_items.code', 'location_item_pricing.unit_cost_override', 'suppliers.code as supplier_code', 'location_item_pricing.is_locked')
            ->get()
            ->toArray();

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Location Pricing');

        // Set header
        $sheet->setCellValue('A1', 'location_id');
        $sheet->setCellValue('B1', 'code');
        $sheet->setCellValue('C1', 'unit_cost');
        $sheet->setCellValue('D1', 'supplier_code');
        $sheet->setCellValue('E1', 'is_locked');

        // Populate data
        $rowNumber = 2;
        foreach ($items as $item) {
            $sheet->setCellValue('A'.$rowNumber, $location->external_id);
            $sheet->setCellValue('B'.$rowNumber, $item->code);
            $sheet->setCellValue('C'.$rowNumber, $item->unit_cost_override);
            $sheet->setCellValue('D'.$rowNumber, $item->supplier_code);
            $sheet->setCellValue('E'.$rowNumber, $item->is_locked ? 'true' : 'false');
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
        $limit = min((int) $request->input('limit', 100), 10000); // Default 100, max 10000

        // Build cache key (unique per filter combination)
        $cacheKey = "material_items:supplier_{$supplierId}:location_{$locationId}:limit_{$limit}:search_".md5($search ?? '');

        return Cache::remember($cacheKey, now()->addMinutes(5), function () use ($supplierId, $locationId, $search, $limit) {
            $query = MaterialItem::query()
                ->select('material_items.id', 'material_items.code', 'material_items.description', 'material_items.unit_cost');

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
                if (! $search) {
                    $query->orderByDesc('is_favourite');
                }
            }

            return $query->limit($limit)->get();
        });
    }

    public function getMaterialItemById($id, $locationId)
    {
        Log::info('Fetching material item with ID: '.$id);
        Log::info('Fetching location with ID: '.$locationId);

        // Fetch the item and its related cost code
        $item = MaterialItem::with('costCode')->find($id);

        // If no item is found, return 404 early
        if (! $item) {
            return response()->json(['message' => 'Item not found'], 404);
        }

        // Fetch the location-specific price (filtered in SQL)
        $location_price = DB::table('location_item_pricing')
            ->where('material_item_id', $id)
            ->where('location_id', $locationId)
            ->join('locations', 'location_item_pricing.location_id', '=', 'locations.id')
            ->select('locations.name as location_name', 'locations.id as location_id', 'location_item_pricing.unit_cost_override', 'location_item_pricing.is_locked')
            ->first();

        Log::info('Location price fetched: '.json_encode($location_price));

        // Check if base price is expired (only applies when no location price exists)
        $priceExpired = false;
        $priceExpiryDate = null;
        $isLocked = false;

        if ($location_price) {
            $item->unit_cost = $location_price->unit_cost_override;
            $isLocked = (bool) $location_price->is_locked;
        } else {
            // Using base price - check if it's expired
            if ($item->price_expiry_date && $item->price_expiry_date->isPast()) {
                $priceExpired = true;
                $priceExpiryDate = $item->price_expiry_date->format('Y-m-d');
            }
        }

        // Convert to array for response
        $itemArray = $item->toArray();
        $itemArray['price_list'] = $location_price ? $location_price->location_name : 'base_price';
        $itemArray['cost_code'] = $item->costCode ? $item->costCode->code : null;
        $itemArray['price_expired'] = $priceExpired;
        $itemArray['price_expiry_date'] = $priceExpiryDate;
        $itemArray['is_locked'] = $isLocked;

        Log::info('Material item found: '.json_encode($itemArray));

        return response()->json($itemArray);
    }

    public function getMaterialItemByCode($code, $locationId)
    {
        Log::info('Fetching material item with code: '.$code);
        Log::info('Fetching location with ID: '.$locationId);

        // Fetch the item and its related cost code
        $item = MaterialItem::with('costCode')->where('code', $code)->first();

        // If no item is found, return 404 early
        if (! $item) {
            return response()->json(['message' => 'Item not found'], 404);
        }

        // Fetch the location-specific price (filtered in SQL)
        $location_price = DB::table('location_item_pricing')
            ->where('material_item_id', $item->id)
            ->where('location_id', $locationId)
            ->join('locations', 'location_item_pricing.location_id', '=', 'locations.id')
            ->select('locations.name as location_name', 'locations.id as location_id', 'location_item_pricing.unit_cost_override', 'location_item_pricing.is_locked')
            ->first();

        Log::info('Location price fetched: '.json_encode($location_price));

        // Check if base price is expired (only applies when no location price exists)
        $priceExpired = false;
        $priceExpiryDate = null;
        $isLocked = false;

        if ($location_price) {
            $item->unit_cost = $location_price->unit_cost_override;
            $isLocked = (bool) $location_price->is_locked;
        } else {
            // Using base price - check if it's expired
            if ($item->price_expiry_date && $item->price_expiry_date->isPast()) {
                $priceExpired = true;
                $priceExpiryDate = $item->price_expiry_date->format('Y-m-d');
            }
        }

        // Convert to array for response
        $itemArray = $item->toArray();
        $itemArray['price_list'] = $location_price ? $location_price->location_name : 'base_price';
        $itemArray['cost_code'] = $item->costCode ? $item->costCode->code : null;
        $itemArray['price_expired'] = $priceExpired;
        $itemArray['price_expiry_date'] = $priceExpiryDate;
        $itemArray['is_locked'] = $isLocked;

        Log::info('Material item found: '.json_encode($itemArray));

        return response()->json($itemArray);
    }
}
