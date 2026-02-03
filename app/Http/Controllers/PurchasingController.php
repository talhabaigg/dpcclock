<?php

namespace App\Http\Controllers;


use App\Models\CostCode;
use App\Services\GetCompanyCodeService;
use App\Services\PremierAuthenticationService;
use GeneratePONumberService;
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
use Spatie\Activitylog\Models\Activity;
use Illuminate\Support\Facades\Log;
use App\Services\POComparisonService;
use App\Services\PremierPurchaseOrderService;
use App\Notifications\RequisitionSentToOfficeNotification;
use App\Models\User;
use Illuminate\Support\Facades\Notification;

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
                ->orWhere('eh_parent_id', 1249093)
                ->orWhere('eh_parent_id', 1198645);
        })
            ->with('worktypes', 'header');

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
            'order_reference' => 'nullable|string|max:80',
            'items' => 'required|array|min:1',
            'items.*.code' => 'nullable|string|max:255',
            'items.*.description' => 'required|string',
            'items.*.qty' => 'required|numeric|min:1',
            'items.*.unit_cost' => 'required|numeric|min:0',
            'items.*.cost_code' => 'required|string|max:255',
            'items.*.price_list' => 'nullable|string|max:255',
            'items.*.serial_number' => 'nullable|integer',
            'items.*.total_cost' => 'nullable|numeric|min:0',
            'items.*.is_locked' => 'nullable|boolean',
        ]);

        // if ($validated['project_id']) {
        //     $location = Location::with('costCodes')->findOrFail($validated['project_id']);
        //     $validCodes = $location->costCodes->pluck('code')->map(fn($c) => strtoupper($c))->toArray();

        //     foreach ($validated['items'] as $index => $item) {
        //         if (!in_array(strtoupper($item['cost_code']), $validCodes)) {
        //             return back()
        //                 ->withErrors([
        //                     "items.$index.cost_code" => "The cost code '{$item['cost_code']}' is not valid for this project.",
        //                 ])
        //                 ->withInput();
        //         }
        //     }
        // }
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
                'is_locked' => $item['is_locked'] ?? false,
            ]);
        }


        // $messageBody = "New requisition order #{$requisition->id} has been submitted by {$requisition->creator->name} for supplier {$requisition->supplier->name} at {$requisition->location->name}.";
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
        // $response = Http::post(env('POWER_AUTOMATE_NOTIFICATION_URL'), [
        //     'user_email' => 'talha@superiorgroup.com.au',
        //     'requisition_id' => (string) $requisition->id,
        //     'message' => $messageBody,
        // ]);

        // if ($response->failed()) {
        //     return redirect()->route('requisition.show', $requisition->id)->with('error', 'Failed to send notification.');
        // }


        return redirect()->route('requisition.show', $requisition->id)->with('success', 'Requisition created successfully.');
    }


    public function index(Request $request)
    {
        $user = auth()->user();

        // Build base query
        $query = Requisition::with('supplier', 'creator', 'location', 'notes.creator')
            ->withSum('lineItems', 'total_cost');

        // Apply permission-based filtering
        if (!$user->hasPermissionTo('requisitions.view-all')) {
            $eh_location_ids = $user->managedKiosks()->pluck('eh_location_id')->toArray();
            $location_ids = Location::whereIn('eh_location_id', $eh_location_ids)->pluck('id')->toArray();
            $query->whereIn('project_number', $location_ids);
        }

        // Apply search filter
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('id', 'like', "%{$search}%")
                    ->orWhere('order_reference', 'like', "%{$search}%")
                    ->orWhereHas('supplier', function ($sq) use ($search) {
                        $sq->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('creator', function ($cq) use ($search) {
                        $cq->where('name', 'like', "%{$search}%");
                    });
            });
        }

        // Apply status filter
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        // Apply supplier filter
        if ($request->filled('supplier')) {
            $query->whereHas('supplier', function ($q) use ($request) {
                $q->where('name', $request->input('supplier'));
            });
        }

        // Apply location filter
        if ($request->filled('location')) {
            $query->whereHas('location', function ($q) use ($request) {
                $q->where('name', $request->input('location'));
            });
        }

        // Apply creator filter
        if ($request->filled('creator')) {
            $query->whereHas('creator', function ($q) use ($request) {
                $q->where('name', $request->input('creator'));
            });
        }

        // Apply deliver_to filter
        if ($request->filled('deliver_to')) {
            $query->where('deliver_to', $request->input('deliver_to'));
        }

        // Apply delivery_contact filter
        if ($request->filled('contact')) {
            $query->where('delivery_contact', $request->input('contact'));
        }

        // Apply templates only filter
        if ($request->boolean('templates_only')) {
            $query->where('is_template', true);
        }

        // Apply cost range filter (withSum already called above)
        if ($request->filled('min_cost')) {
            $query->having('line_items_sum_total_cost', '>=', $request->input('min_cost'));
        }
        if ($request->filled('max_cost')) {
            $query->having('line_items_sum_total_cost', '<=', $request->input('max_cost'));
        }

        // Order and paginate
        $requisitions = $query->orderByDesc('id')->paginate(50)->withQueryString();

        // Get filter options for dropdowns
        $filterOptionsQuery = Requisition::query();
        if (!$user->hasPermissionTo('requisitions.view-all')) {
            $eh_location_ids = $user->managedKiosks()->pluck('eh_location_id')->toArray();
            $location_ids = Location::whereIn('eh_location_id', $eh_location_ids)->pluck('id')->toArray();
            $filterOptionsQuery->whereIn('project_number', $location_ids);
        }

        $filterOptions = [
            'statuses' => Requisition::distinct()->pluck('status')->filter()->values(),
            'suppliers' => Supplier::whereIn('id', $filterOptionsQuery->clone()->distinct()->pluck('supplier_number'))
                ->pluck('name')->filter()->values(),
            'locations' => Location::whereIn('id', $filterOptionsQuery->clone()->distinct()->pluck('project_number'))
                ->pluck('name')->filter()->values(),
            'creators' => \App\Models\User::whereIn('id', $filterOptionsQuery->clone()->distinct()->pluck('created_by'))
                ->pluck('name')->filter()->values(),
            'deliver_to' => $filterOptionsQuery->clone()->distinct()->pluck('deliver_to')->filter()->values(),
            'contacts' => $filterOptionsQuery->clone()->distinct()->pluck('delivery_contact')->filter()->values(),
        ];

        // Get cost range for slider
        $costStats = DB::table('requisitions')
            ->selectRaw('
                MIN((SELECT COALESCE(SUM(total_cost), 0) FROM requisition_line_items WHERE requisition_line_items.requisition_id = requisitions.id)) as min_cost,
                MAX((SELECT COALESCE(SUM(total_cost), 0) FROM requisition_line_items WHERE requisition_line_items.requisition_id = requisitions.id)) as max_cost
            ')
            ->whereNull('deleted_at')
            ->first();

        return Inertia::render('purchasing/index', [
            'requisitions' => $requisitions,
            'filterOptions' => $filterOptions,
            'costRange' => [
                'min' => (float) ($costStats->min_cost ?? 0),
                'max' => (float) ($costStats->max_cost ?? 10000),
            ],
            'filters' => [
                'search' => $request->input('search', ''),
                'status' => $request->input('status', ''),
                'supplier' => $request->input('supplier', ''),
                'location' => $request->input('location', ''),
                'creator' => $request->input('creator', ''),
                'deliver_to' => $request->input('deliver_to', ''),
                'contact' => $request->input('contact', ''),
                'templates_only' => $request->boolean('templates_only'),
                'min_cost' => $request->input('min_cost', ''),
                'max_cost' => $request->input('max_cost', ''),
            ],
        ]);
    }

    public function show($id)
    {
        $requisition = Requisition::with('supplier', 'lineItems', 'location', 'creator', 'submitter', 'processor')->withSum('lineItems', 'total_cost')->findOrFail($id);
        $requisitionItemIds = $requisition->lineItems()->pluck('id');
        $activities = Activity::query()
            ->with('causer')
            ->where(function ($query) use ($requisition, $requisitionItemIds) {
                $query->where(function ($q) use ($requisition) {
                    $q->where('subject_type', Requisition::class)
                        ->where('subject_id', $requisition->id);
                })->orWhere(function ($q) use ($requisitionItemIds) {
                    $q->where('subject_type', RequisitionLineItem::class)
                        ->whereIn('subject_id', $requisitionItemIds);
                });
            })
            ->orderBy('id', 'desc')
            ->get();


        return Inertia::render('purchasing/show', [
            'requisition' => $requisition,
            'activities' => $activities
        ]);
    }

    public function printPreview($id)
    {
        $requisition = Requisition::with('supplier', 'lineItems', 'location', 'creator')
            ->withSum('lineItems', 'total_cost')
            ->findOrFail($id);

        return Inertia::render('purchasing/print', [
            'requisition' => $requisition,
            'printedBy' => auth()->user()->name,
            'printedAt' => now()->format('d/m/Y H:i'),
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

        $locationId = $newRequisition->project_number;

        foreach ($originalRequisition->lineItems as $lineItem) {
            $newLineItem = $lineItem->replicate();
            $newLineItem->requisition_id = $newRequisition->id;

            // Refresh price from current project price lists
            if ($lineItem->code) {
                $currentPrice = $this->getCurrentItemPrice($lineItem->code, $locationId);
                if ($currentPrice) {
                    // Item has project-specific pricing - use it
                    $newLineItem->unit_cost = $currentPrice['unit_cost'];
                    $newLineItem->total_cost = $currentPrice['unit_cost'] * $newLineItem->qty;
                    $newLineItem->price_list = $currentPrice['price_list'];
                    $newLineItem->is_locked = $currentPrice['is_locked'];
                } else {
                    // No project pricing - set to $0 (no base prices)
                    $newLineItem->unit_cost = 0;
                    $newLineItem->total_cost = 0;
                    $newLineItem->price_list = null;
                    $newLineItem->is_locked = false;
                }
            } else {
                // No item code - set to $0
                $newLineItem->unit_cost = 0;
                $newLineItem->total_cost = 0;
                $newLineItem->price_list = null;
                $newLineItem->is_locked = false;
            }

            $newLineItem->save();
        }

        return redirect()->route('requisition.edit', $newRequisition->id)->with('success', 'Requisition copied successfully. Prices have been updated to current values.');
    }

    /**
     * Get current price for an item from location pricing only
     * Returns null if no location-specific pricing exists (keeps original price)
     */
    private function getCurrentItemPrice($code, $locationId)
    {
        $item = MaterialItem::where('code', $code)->first();

        if (!$item) {
            return null;
        }

        // Check for location-specific pricing only
        $locationPrice = DB::table('location_item_pricing')
            ->where('material_item_id', $item->id)
            ->where('location_id', $locationId)
            ->join('locations', 'location_item_pricing.location_id', '=', 'locations.id')
            ->select('locations.name as location_name', 'location_item_pricing.unit_cost_override', 'location_item_pricing.is_locked')
            ->first();

        if ($locationPrice) {
            return [
                'unit_cost' => $locationPrice->unit_cost_override,
                'price_list' => $locationPrice->location_name,
                'is_locked' => (bool) $locationPrice->is_locked,
            ];
        }

        // No location pricing - return null to keep original price
        return null;
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
            $companyCodes = [
                '1149031' => 'SWC',
                '1198645' => 'GREEN',
                '1249093' => 'SWCP'
            ];
            $companyCode = $companyCodes[$parentId] ?? null;
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
        $requisition = Requisition::with('creator', 'lineItems', 'location')->findOrFail($id);
        $validateService = new \App\Services\ValidateRequisitionService();
        $generatePONumberService = new \App\Services\GeneratePONumberService();
        $requisitionService = new \App\Services\RequisitionService();
        $status = $validateService->validateStatus($requisition);
        if ($status instanceof \Illuminate\Http\RedirectResponse) {
            return $status; // Stop processing and redirect
        }
        $cc = $validateService->validateCostCodes($requisition);
        if ($cc instanceof \Illuminate\Http\RedirectResponse) {
            return $cc; // Stop processing and redirect
        }
        if (!$requisition->po_number) {
            $next_num = $generatePONumberService->generate($requisition);
        }

        // Track who processed the requisition and when
        $requisition->processed_at = now();
        $requisition->processed_by = auth()->id();
        $requisition->save();

        $excelService = new ExcelExportService();
        $fileName = $excelService->generateCsv($requisition);
        activity()
            ->performedOn($requisition)
            ->causedBy(auth()->user())
            ->event('sent to premier')
            ->withProperties([
                'po_number' => $requisition->po_number,
                'file_uploaded' => "upload/{$fileName}",
            ])
            ->log("Requisition #{$requisition->id} processed and sent to Premier.");

        $uploaded = $requisitionService->sendExcelFileToSFTP($fileName);
        if ($uploaded) {
            $requisitionService->notifyRequisitionProcessed($requisition);
        } else {
            dd('SFTP upload failed');
        }

    }

    public function sendApi($id)
    {
        // dd('please use other method - temporarily disabled to fix bug');
        $requisition = Requisition::with('creator', 'lineItems', 'location')->findOrFail($id);

        // If status is office_review, user must have approve-pricing permission (backoffice only)
        if ($requisition->status === 'office_review' && !auth()->user()->can('requisitions.approve-pricing')) {
            return redirect()->back()->with('error', 'You do not have permission to approve pricing and send from office review.');
        }

        $validateService = new \App\Services\ValidateRequisitionService();
        $generatePONumberService = new \App\Services\GeneratePONumberService();
        $requisitionService = new \App\Services\RequisitionService();
        $validateService->validateStatus($requisition);
        $validateService->validateCostCodes($requisition);
        if (!$requisition->po_number) {
            $generatePONumberService->generate($requisition);
        }

        // Track who processed the requisition and when
        $requisition->processed_at = now();
        $requisition->processed_by = auth()->id();
        $requisition->save();

        $authService = new PremierAuthenticationService();
        $token = $authService->getAccessToken();
        $parentId = Location::where('id', $requisition->project_number)->value('eh_parent_id');
        $companyService = new GetCompanyCodeService();
        $companyCode = $companyService->getCompanyCode($parentId);
        $payload = $requisitionService->generateRequisitionPayload($requisition, $companyCode);
        $requisitionService->sendRequisitionToPremierViaAPI($requisition, $payload);
    }





    public function markSentToSupplier($id)
    {
        $requisition = Requisition::findOrFail($id);
        $requisition->status = 'sent';
        $requisition->save();

        activity()
            ->performedOn($requisition)
            ->event('sent to supplier')
            ->causedBy(auth()->user())
            ->log("Requisition #{$requisition->id} was marked as sent to supplier.");
        return redirect()->back()->with('success', 'Marked as sent from Premier to Supplier');
    }

    public function sendToOffice($id)
    {
        $requisition = Requisition::with(['location', 'supplier', 'lineItems'])->findOrFail($id);

        if ($requisition->status !== 'pending') {
            return redirect()->back()->with('error', 'Requisition must be in pending status to send to office.');
        }

        $requisition->status = 'office_review';
        $requisition->submitted_at = now();
        $requisition->submitted_by = auth()->id();
        $requisition->save();

        activity()
            ->performedOn($requisition)
            ->event('sent to office')
            ->causedBy(auth()->user())
            ->log("Requisition #{$requisition->id} was sent to office for review.");

        // Send notification to backoffice users
        $backofficeUsers = User::role('backoffice')->get();
        Notification::send($backofficeUsers, new RequisitionSentToOfficeNotification($requisition, auth()->user()));

        return redirect()->back()->with('success', 'Requisition sent to office for review.');
    }

    public function refreshPricing($id)
    {
        $requisition = Requisition::with('lineItems')->findOrFail($id);

        if (!in_array($requisition->status, ['pending', 'failed', 'office_review'])) {
            return redirect()->back()->with('error', 'Cannot refresh pricing for requisitions that have been sent.');
        }

        $locationId = $requisition->project_number;
        $updatedCount = 0;
        $zeroPriceCount = 0;

        foreach ($requisition->lineItems as $lineItem) {
            if ($lineItem->code) {
                $currentPrice = $this->getCurrentItemPrice($lineItem->code, $locationId);
                if ($currentPrice) {
                    $lineItem->unit_cost = $currentPrice['unit_cost'];
                    $lineItem->total_cost = $currentPrice['unit_cost'] * $lineItem->qty;
                    $lineItem->price_list = $currentPrice['price_list'];
                    $lineItem->is_locked = $currentPrice['is_locked'];
                    $updatedCount++;
                } else {
                    // No project pricing - set to $0
                    $lineItem->unit_cost = 0;
                    $lineItem->total_cost = 0;
                    $lineItem->price_list = null;
                    $lineItem->is_locked = false;
                    $zeroPriceCount++;
                }
                $lineItem->save();
            }
        }

        activity()
            ->performedOn($requisition)
            ->event('pricing refreshed')
            ->causedBy(auth()->user())
            ->withProperties([
                'updated_count' => $updatedCount,
                'zero_price_count' => $zeroPriceCount,
            ])
            ->log("Requisition #{$requisition->id} pricing was refreshed. {$updatedCount} items updated, {$zeroPriceCount} items set to \$0.");

        $message = "Pricing refreshed. {$updatedCount} items updated from project price list.";
        if ($zeroPriceCount > 0) {
            $message .= " {$zeroPriceCount} items set to \$0 (no project pricing).";
        }

        return redirect()->back()->with('success', $message);
    }

    public function edit($id)
    {

        $requisition = Requisition::with('supplier', 'lineItems')->findOrFail($id);
        $canEdit = $requisition->status === 'pending'
            || $requisition->status === 'failed'
            || ($requisition->status === 'office_review' && auth()->user()->can('requisitions.approve-pricing'));

        if (!$canEdit) {
            return redirect()->route('requisition.show', $id)->with('error', 'Requisition is not in pending or failed status.');
        }
        $suppliers = Supplier::all();
        $locations = Location::where('eh_parent_id', 1149031)->orWhere('eh_parent_id', 1198645)->orWhere('eh_parent_id', 1249093)->get();
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
            'items.*.is_locked' => 'nullable|boolean',
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
        $now = now()->format('Ymd_His');
        $poNumber = $requisition->po_number ?? 'NA';
        $fileName = "PO-{$poNumber}-{$requisition->id}-{$now}.pdf";
        activity()
            ->performedOn($requisition)
            ->event('PDF Print')
            ->causedBy(auth()->user())

            ->log("Requisition #{$requisition->id} was printed.");
        return $pdf->download("{$fileName}.pdf");
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
                        'UofM' => ((float) $lineItem->qty != (int) $lineItem->qty) ? 'm' : 'EA',

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
        activity()
            ->performedOn($requisition)
            ->causedBy(auth()->user())
            ->log("Requisition #{$requisition->id} was received in Premier");
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

    public function getPurchaseOrdersForLocation($locationId)
    {

        $location = Location::findOrFail($locationId);

        $requisitionService = new \App\Services\RequisitionService();
        $purchaseOrders = $requisitionService->loadPurchaseOrderIdsForLocation($locationId);

        foreach ($purchaseOrders->json('Data') as $index => $po) {
            $po_number = preg_replace('/^PO/', '', $po['PONumber']);
            $requisition = Requisition::where('po_number', $po_number)->first();
            if ($requisition) {
                $requisition->premier_po_id = $po['PurchaseOrderId'];
                $requisition->save();
            }
        }

        return response()->json([
            'purchase_orders' => $purchaseOrders->json(),
        ]);

    }

    /**
     * Get comparison data between local requisition and Premier PO
     */
    public function getComparison($id)
    {
        $requisition = Requisition::with('lineItems')->findOrFail($id);

        if (!$requisition->premier_po_id) {
            return response()->json([
                'error' => 'This requisition has not been synced with Premier yet.',
                'can_compare' => false,
            ], 400);
        }

        try {
            $comparisonService = new POComparisonService();
            $comparison = $comparisonService->compare($requisition);

            return response()->json([
                'can_compare' => true,
                ...$comparison,
            ]);
        } catch (\Exception $e) {
            Log::error('PO Comparison failed', [
                'requisition_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to fetch comparison data: ' . $e->getMessage(),
                'can_compare' => false,
            ], 500);
        }
    }

    /**
     * Refresh comparison data (clear cache and re-fetch)
     */
    public function refreshComparison($id)
    {
        $requisition = Requisition::findOrFail($id);

        if (!$requisition->premier_po_id) {
            return response()->json(['error' => 'No Premier PO ID'], 400);
        }

        $premierService = new PremierPurchaseOrderService();
        $premierService->clearCache($requisition->premier_po_id);

        return $this->getComparison($id);
    }
}
