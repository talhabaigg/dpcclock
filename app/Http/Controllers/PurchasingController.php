<?php

namespace App\Http\Controllers;


use App\Models\CostCode;
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
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Http;
use App\Services\ExcelExportService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class PurchasingController extends Controller
{
    public function create()
    {
        $user = auth()->user();

        $suppliers = Supplier::all();
        $costCodes = CostCode::select('id', 'code', 'description')->ordered()->get();

        // Group OR conditions properly
        $locationsQuery = Location::where(function ($query) {
            $query->where('eh_parent_id', 1149031)
                ->orWhere('eh_parent_id', 1198645);
        })
            ->with('worktypes');

        if ($user->hasRole('manager')) {
            $ehLocationIds = $user->managedKiosks()->pluck('eh_location_id');
            $locationsQuery->whereIn('eh_location_id', $ehLocationIds);
        }

        $locations = $locationsQuery->get();


        return Inertia::render('purchasing/create', [
            'suppliers' => $suppliers,
            'locations' => $locations,
            'costCodes' => $costCodes,
        ]);
    }


    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_id' => 'nullable|integer|exists:locations,id',
            'supplier_id' => 'required|integer|exists:suppliers,id',
            'date_required' => 'required|date',
            'delivery_contact' => 'nullable|string|max:255',
            'requested_by' => 'required|string|max:255',
            'deliver_to' => 'nullable|string|max:255',
            'order_reference' => 'nullable|string|max:255',
            'items' => 'required|array|min:1',
            'items.*.code' => 'nullable|string|max:255',
            'items.*.description' => 'required|string',
            'items.*.qty' => 'required|numeric|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0',
            'items.*.cost_code' => 'required|string|max:255',
            'items.*.price_list' => 'nullable|string|max:255',
            'items.*.serial_number' => 'nullable|integer',
            'items.*.total_cost' => 'nullable|numeric|min:0',
        ]);


        $requisition = Requisition::create([
            'project_number' => $validated['project_id'] ?? 1,
            'supplier_number' => $validated['supplier_id'],
            'date_required' => isset($validated['date_required'])
                ? Carbon::parse($validated['date_required'])->toDateTimeString() // Converts to 'Y-m-d H:i:s'
                : now(),
            'delivery_contact' => $validated['delivery_contact'] ?? null,
            'requested_by' => $validated['requested_by'] ?? null,
            'deliver_to' => $validated['deliver_to'] ?? null,
            'order_reference' => $validated['order_reference'] ?? null,
        ]);

        // dd($requisition);

        foreach ($validated['items'] as $item) {
            RequisitionLineItem::create([
                'serial_number' => $item['serial_number'] ?? null,
                'requisition_id' => $requisition->id,
                'code' => $item['code'] ?? null,
                'description' => $item['description'],
                'qty' => $item['qty'],
                'unit_cost' => $item['unit_cost'],
                'cost_code' => $item['cost_code'] ?? null,
                'price_list' => $item['price_list'] ?? null,
                'total_cost' => $item['total_cost'] ?? 0,
            ]);
        }


        $messageBody = "New requisition order #{$requisition->id} has been submitted by {$requisition->creator->name} for supplier {$requisition->supplier->name} at {$requisition->location->name}.";
        // dd($messageBody);
        // $recipients = ['talha@superiorgroup.com.au', 'dominic.armitage@superiorgroup.com.au'];

        // foreach ($recipients as $recipient) {
        //     $response = Http::post(env('POWER_AUTOMATE_NOTIFICATION_URL'), [
        //         'user_email' => $recipient,
        //         'message' => $messageBody,
        //     ]);

        //     if ($response->failed()) {
        //         return redirect()->route('requisition.index')->with('error', 'Failed to send notification.');
        //     }
        // }
        $response = Http::post(env('POWER_AUTOMATE_NOTIFICATION_URL'), [
            'user_email' => 'talha@superiorgroup.com.au',
            'requisition_id' => (string) $requisition->id,
            'message' => $messageBody,
        ]);

        if ($response->failed()) {
            return redirect()->route('requisition.show', $requisition->id)->with('error', 'Failed to send notification.');
        }


        return redirect()->route('requisition.show', $requisition->id)->with('success', 'Requisition created successfully.');
    }


    public function index()
    {
        $user = auth()->user();

        if ($user->hasPermissionTo('view all requisitions')) {
            $requisitions = Requisition::with('supplier', 'creator', 'location')
                ->withSum('lineItems', 'total_cost')
                ->orderByDesc('id')
                ->get();
            return Inertia::render('purchasing/index', [
                'requisitions' => $requisitions,
            ]);
        }
        $eh_location_ids = $user->managedKiosks()->pluck('eh_location_id')->toArray();

        $location_ids = Location::whereIn('eh_location_id', $eh_location_ids)->pluck('id')->toArray();



        $requisitions = Requisition::with('supplier', 'creator', 'location')
            ->withSum('lineItems', 'total_cost')
            ->whereIn('project_number', $location_ids)
            ->orderByDesc('id')
            ->get();

        return Inertia::render('purchasing/index', [
            'requisitions' => $requisitions,
        ]);
    }

    public function show($id)
    {
        $requisition = Requisition::with('supplier', 'lineItems', 'location', 'creator')->withSum('lineItems', 'total_cost')->findOrFail($id);
        return Inertia::render('purchasing/show', [
            'requisition' => $requisition,
        ]);
    }

    public function copy($id)
    {
        $originalRequisition = Requisition::with('lineItems')->findOrFail($id);

        $newRequisition = $originalRequisition->replicate();
        $newRequisition->status = 'pending';
        $newRequisition->po_number = null; // Reset PO number
        $newRequisition->is_template = false; // Reset template status
        $newRequisition->created_at = now();
        $newRequisition->updated_at = now();
        $newRequisition->save();

        foreach ($originalRequisition->lineItems as $lineItem) {
            $newLineItem = $lineItem->replicate();
            $newLineItem->requisition_id = $newRequisition->id;
            $newLineItem->save();
        }

        return redirect()->route('requisition.edit', $newRequisition->id)->with('success', 'Requisition copied successfully.');
    }

    public function toggleRequisitionTemplate($id)
    {
        $requisition = Requisition::findOrFail($id);
        $wasTemplate = $requisition->is_template;

        $requisition->is_template = !$wasTemplate;
        $requisition->save();

        $message = $requisition->is_template
            ? 'Marked as a template successfully.'
            : 'Removed template successfully.';

        return redirect()->back()->with('success', $message);
    }

    public function destroy($id)
    {
        $requisition = Requisition::findOrFail($id);
        $requisition->delete();

        return redirect()->route('requisition.index')->with('success', 'Requisition deleted successfully.');
    }

    private function getPONumber($requisition)
    {
        return DB::transaction(function () use ($requisition) {
            $parentId = Location::where('id', $requisition->project_number)->value('eh_parent_id');
            if ($parentId === '1149031') {
                $companyCode = 'SWC';
            } elseif ($parentId === '1198645') {
                $companyCode = 'GREEN';
            } else {
                throw new \Exception('Invalid parent ID for PO number generation.');
            }
            $sequence = DB::table('po_num_sequence')->lockForUpdate()->where('company_code', $companyCode)->first();

            // Build formatted PO number
            $poNumber = str_pad($sequence->next_po_number, 6, '0', STR_PAD_LEFT);

            // Assign and save
            $requisition->po_number = $poNumber;
            $requisition->status = 'processed';
            $requisition->save();

            // Increment the sequence
            DB::table('po_num_sequence')->where('company_code', $companyCode)->update([
                'next_po_number' => $sequence->next_po_number + 1,
            ]);

            return $poNumber; // ✅ Make sure to return the PO number
        });
    }
    public function process($id)
    {
        $requisition = Requisition::with('creator')->findOrFail($id);
        if ($requisition->status !== 'pending') {
            return redirect()->route('requisition.index')->with('error', 'Requisition is not in pending status.');
        }
        $next_num = $this->getPONumber($requisition);

        // dd('PO' . $next_num);



        $excelService = new ExcelExportService();
        $fileName = $excelService->generateCsv($requisition);



        $fileContent = Storage::disk('public')->get($fileName);
        // For testing: return the Excel file as a download
        // dd('excel generated', $fileContent);
        // Upload to SFTP
        // $uploaded = true;

        $uploaded = Storage::disk('premier_sftp')->put("upload/{$fileName}", $fileContent);

        if ($uploaded) {
            $creator = $requisition->creator;
            $creatorEmail = $creator->email ?? null;
            // dd($creatorEmail);
            if (!$creatorEmail) {
                return redirect()->route('requisition.index')->with('success', 'Creator email not found.');
            }

            $timestamp = now()->format('d/m/Y h:i A');
            $auth = auth()->user()->name;
            $messageBody = "Requisition #{$requisition->id} (PO number (PO{$requisition->po_number})) has been sent to Premier for Processing by {$auth}.";

            // $recepients = [$creatorEmail, 'talha@superiorgroup.com.au', 'dominic.armitage@superiorgroup.com.au', 'kylie@superiorgroup.com.au', 'robyn.homann@superiorgroup.com.au'];
            // $recepients = array_unique($recepients); // Ensure unique recipients

            // foreach ($recepients as $recepient) {
            //     $response = Http::post(env('POWER_AUTOMATE_NOTIFICATION_URL'), [
            //         'user_email' => $recepient,
            //         'requisition_id' => $requisition->id,
            //         'message' => $messageBody,
            //     ]);

            //     if ($response->failed()) {
            //         return redirect()->route('requisition.index')->with('error', 'Failed to send notification.');
            //     }
            // }
            $response = Http::post(env('POWER_AUTOMATE_NOTIFICATION_URL'), [
                'user_email' => $creatorEmail,
                'requisition_id' => $requisition->id,
                'message' => $messageBody,
            ]);

            if ($response->failed()) {
                return redirect()->route('requisition.index')->with('error', 'Failed to send notification.');
            }

            $requisition->update([
                'status' => 'sent to premier',
                'processed_by' => auth()->id(),
            ]);

            if ($response->failed()) {
                return redirect()->route('requisition.index')->with('success', 'Failed to send notification.');
            }

            return redirect()->route('requisition.index')->with('success', 'Requisition processed and submitted successfully.');

        } else {
            dd('SFTP upload failed');
        }

    }


    public function edit($id)
    {
        $requisition = Requisition::with('supplier', 'lineItems')->findOrFail($id);
        $suppliers = Supplier::all();
        $locations = Location::where('eh_parent_id', 1149031)->orWhere('eh_parent_id', 1198645)->get();
        $costCodes = CostCode::select('id', 'code', 'description')->get();

        return Inertia::render('purchasing/create', [
            'requisition' => $requisition,
            'suppliers' => $suppliers,
            'locations' => $locations,
            'costCodes' => $costCodes,
        ]);
    }

    public function update(Request $request, $id)
    {
        $requisition = Requisition::findOrFail($id);
        // dd($request->all());
        $validated = $request->validate([
            'project_id' => 'required|integer',
            'supplier_id' => 'required|integer',
            'date_required' => 'required|date',
            'delivery_contact' => 'nullable|string',
            'requested_by' => 'nullable|string',
            'deliver_to' => 'nullable|string',
            'order_reference' => 'nullable|string|max:255',
            'items' => 'required|array',
            'items.*.code' => 'nullable|string',
            'items.*.description' => 'required|string',
            'items.*.unit_cost' => 'nullable|numeric',
            'items.*.qty' => 'required|numeric',
            'items.*.total_cost' => 'nullable|numeric',
            'items.*.serial_number' => 'nullable|integer',
            'items.*.cost_code' => 'nullable|string',
            'items.*.price_list' => 'nullable|string',
        ]);
        // dd($validated);

        $requisition->update([
            'project_number' => $validated['project_id'],
            'supplier_id' => $validated['supplier_id'],
            'date_required' => isset($validated['date_required'])
                ? Carbon::parse($validated['date_required'])->toDateTimeString() // Converts to 'Y-m-d H:i:s'
                : now(),
            'delivery_contact' => $validated['delivery_contact'],
            'requested_by' => $validated['requested_by'],
            'deliver_to' => $validated['deliver_to'],
            'order_reference' => $validated['order_reference'] ?? null,
        ]);

        // Optionally delete and recreate line items, or update them if you store them in a separate table
        $requisition->lineItems()->delete();
        foreach ($validated['items'] as $item) {
            $requisition->lineItems()->create($item);
        }

        return redirect()->route('requisition.show', $requisition->id)->with('success', 'Requisition updated.');
    }
    public function __invoke(Requisition $requisition)
    {
        $pdf = pdf::loadView('requisition.pdf', [
            'requisition' => Requisition::with(['lineItems', 'location'])->find($requisition->id),
        ]);
        return $pdf->download("{$requisition->id}.pdf");
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
                        'Vendor Code' => $requisition->supplier?->code ?? 'N/A',
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
                        'Line Description' => $lineItem->code . '-' . $lineItem->description ?? 'N/A',
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

        if (!$stored) {
            abort(500, 'Failed to store Excel file.');
        }

        if (!file_exists($filePath)) {
            Log::error("Excel file not found: {$filePath}");
            abort(404, 'Excel file not found.');
        }

        return response()->download($filePath, $fileName);
    }

    public function updateStatusFromBuildMetrix(Request $request)
    {
        $guid = $request->query('guid');
        $status = (int) $request->query('status');
        $fileName = $request->query('file_name');

        // Validate GUID
        if ($guid !== config('app.buildmetrix_guid')) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        // Extract PO number
        if (!preg_match('/PO-(\d{6})/', $fileName, $matches)) {
            return response()->json(['error' => 'PO number not found in file name'], 400);
        }

        $poNumber = $matches[1];

        $requisition = Requisition::where('po_number', $poNumber)->first();

        if (!$requisition) {
            return response()->json([
                'error' => 'Requisition not found',
                'po_number' => $poNumber
            ], 404);
        }

        if ($status === 200) {
            $requisition->status = 'success';
            $requisition->save();

            return response()->json([
                'message' => 'Status updated successfully',
                'po_number' => $poNumber,
                'status' => $requisition->status
            ], 200);
        } else {
            $requisition->status = 'failed';
            $requisition->save();

            return response()->json([
                'message' => 'Status not updated due to non-200 status code',
                'po_number' => $poNumber,
                'received_status' => $status
            ], 202);
        }
    }

    public function updateStatusFromPowerAutomate(Request $request)
    {
        // $guid = $request->query('guid');
        $body = $request->getContent();
        preg_match('/PO-\d+/', $body, $matches);

        $poNumber = $matches[0] ?? null;

        return response()->json([
            'message' => 'received successfully',
            'body' => $poNumber
        ]);
    }



}
