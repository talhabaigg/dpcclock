<?php

namespace App\Http\Controllers;


use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Supplier;
use App\Models\Location;
use App\Models\Requisition;
use App\Models\RequisitionLineItem;
use App\Models\MaterialItem;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Illuminate\Support\Str;


class PurchasingController extends Controller
{
    public function create()
    {
        $suppliers = Supplier::all();

        $locations = Location::where('eh_parent_id', 1149031)->get();
        return Inertia::render('purchasing/create', [
            'suppliers' => $suppliers,
            'locations' => $locations,
        ]);
    }

    public function store(Request $request)
{
    $validated = $request->validate([
        'project_id' => 'nullable|integer|exists:locations,id',
        'supplier_id' => 'required|integer|exists:suppliers,id',
        'date_required' => 'nullable|date',
        'delivery_contact' => 'nullable|string|max:255',
        'requested_by' => 'nullable|string|max:255',
        'deliver_to' => 'nullable|string|max:255',
        'items' => 'required|array|min:1',
        'items.*.itemcode' => 'nullable|string|max:255',
        'items.*.description' => 'nullable|string',
        'items.*.qty' => 'required|numeric|min:1',
        'items.*.unitcost' => 'required|numeric|min:0',
        'items.*.costcode' => 'nullable|string|max:255',
        'items.*.price_list' => 'nullable|string|max:255',
        'items.*.lineIndex' => 'nullable|integer',
        'items.*.total' => 'nullable|numeric|min:0',
    ]);
    // dd($validated);
    $requisition = Requisition::create([
        'project_number' => $validated['project_id']?? 1,
        'supplier_number' => $validated['supplier_id'],
        'date_required' => $validated['date_required'] ?? now(),
        'delivery_contact' => $validated['delivery_contact'] ?? null,
        'requested_by' => $validated['requested_by'] ?? null,
        'deliver_to' => $validated['deliver_to'] ?? null,
    ]);

    foreach ($validated['items'] as $item) {
        RequisitionLineItem::create([
            'serial_number' => $item['lineIndex'] ?? null,
            'requisition_id' => $requisition->id,
            'code' => $item['itemcode'],
            'description' => $item['description'],
            'qty' => $item['qty'],
            'unit_cost' => $item['unitcost'],
            'cost_code' => $item['costcode'] ?? null,
            'price_list' => $item['price_list'] ?? null,
            'total_cost' => $item['total'] ?? 0,
        ]);
    }

    return redirect()->route('requisition.index')->with('success', 'Requisition created successfully.');
}

    public function index()
    {
        $requisitions = Requisition::with('supplier')
        ->withSum('lineItems', 'total_cost')
        ->get();
       
        return Inertia::render('purchasing/index', [
            'requisitions' => $requisitions,
        ]);
    }

    public function show($id)
    {
        $requisition = Requisition::with('supplier', 'lineItems')->findOrFail($id);
        return Inertia::render('purchasing/show', [
            'requisition' => $requisition,
        ]);
    }

    public function excelImport(Requisition $requisition)
    {
        // Generate a unique file name with a UUID
        $uuid = Str::uuid();
        
        
        $fileName = sprintf('PO-%s-import.xlsx', $uuid);
   
        // Define the file path
        $filePath = storage_path('app/public/' . $fileName);

        // Create and export an Excel file using a closure
        $stored = Excel::store(new class ($requisition) implements \Maatwebsite\Excel\Concerns\FromCollection {
            protected $requisition;

            public function __construct($requisition)
            {
                $this->requisition = $requisition;
            }

            public function collection()
            {
                $requisition = Requisition::with(['lineItems', 'supplier'])->find($this->requisition->id);
                

                // Prepare the header row
                $headers = [
                    'AP Subledger',
                    'PO #',
                    'Vendor Code',
                    'Job #',
                    'Memo',
                    'PO Date',
                    'Required Date',
                    'Promised Date',
                    'Ship To Type',
                    'Ship To',
                    'Requested By',
                    'Line',
                    'Item Code',
                    'Line Description',
                    'Qty',
                    'UofM',
                    'Unit Cost',
                    'Distribution Type',
                    'Line Job #',
                    'Cost Item',
                    'Cost Type',
                    'Department',
                    'Location',
                    'GL Account',
                    'GL Division',
                    'GL SubAccount',
                    'Tax Group',
                    'Discount %'
                ];

                // Initialize the collection with the header row
                $rows = collect([$headers]);

                // Iterate over line items and prepare each row
                foreach ($requisition->lineItems as $index => $lineItem) {

                    $materialItem = MaterialItem::where('code', $lineItem->item_code)->first();
                    $costcode = $materialItem?->costcode;

                    // Format only if costcode is present
                    $formattedCostcode = $costcode
                        ? substr($costcode, 0, 2) . '-' . substr($costcode, 2)
                        : 'N/A'; // or '' or null depending on what you want in export

                    $row = [
                        'AP Subledger' => 'AP',
                        'PO #' => 'NEXT #',
                        'Vendor Code' => $requisition->supplier?->code  ?? 'N/A',
                        'Job #' => $requisition->location?->external_id ?? 'N/A',
                        'Memo' => $requisition->notes ?? 'N/A',
                        'PO Date' => now()->toDateString(),
                        'Required Date' => $requisition->date_required ?? 'N/A',
                        'Promised Date' => $requisition->date_required ?? 'N/A',
                        'Ship To Type' => 'JOB',
                        'Ship To' => $requisition->location?->external_id ?? 'N/A',
                        'Requested By' => $requisition->requested_by ?? 'N/A',
                        'Line' => $index + 1,
                        'Item Code' => '',
                        'Line Description' => $lineItem->code  . '-' . $lineItem->description ?? 'N/A',
                        'Qty' => $lineItem->qty ?? 0,
                        'UofM' => 'EA',
                        'Unit Cost' => $lineItem->unit_cost ?? 0,
                        'Distribution Type' => 'J',
                        'Line Job #' => $requisition->location?->external_id ?? 'N/A',
                        'Cost Item' => $lineItem->cost_code ?? '32-01',
                        'Cost Type' => 'MAT',
                        'Department' => '',
                        'Location' => '',
                        'GL Account' => '',
                        'GL Division' => '',
                        'GL SubAccount' => '',
                        'Tax Group' => 'GST',
                        'Discount %' => ''
                    ];

                    $rows->push($row);
                }

                return $rows;
            }
        }, $fileName, 'public', ExcelFormat::XLSX);

        if (! $stored) {
            abort(500, 'Failed to store Excel file.');
        }
    
        if (!file_exists($filePath)) {
            Log::error("Excel file not found: {$filePath}");
            abort(404, 'Excel file not found.');
        }
        
        return response()->download($filePath, $fileName)->deleteFileAfterSend();
    }

    
}
