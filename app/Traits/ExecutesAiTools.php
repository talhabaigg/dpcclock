<?php

namespace App\Traits;

use App\Models\JobSummary;
use App\Models\Location;
use App\Models\MaterialItem;
use App\Models\ProductionUpload;
use App\Models\ProductionUploadLine;
use App\Models\Requisition;
use App\Models\RequisitionLineItem;
use App\Models\Supplier;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

trait ExecutesAiTools
{
    /**
     * Execute a tool call by name with given arguments.
     */
    public function executeAiToolCall(string $name, array $arguments): string
    {
        try {
            return match ($name) {
                // Read tools
                'read_requisition' => $this->toolReadRequisition($arguments),
                'search_requisitions' => $this->toolSearchRequisitions($arguments),
                'get_requisition_stats' => $this->toolGetRequisitionStats($arguments),
                'list_locations' => $this->toolListLocations($arguments),
                'list_suppliers' => $this->toolListSuppliers($arguments),
                'search_materials' => $this->toolSearchMaterials($arguments),
                'get_material_price' => $this->toolGetMaterialPrice($arguments),
                // Create tools
                'create_requisition' => $this->toolCreateRequisition($arguments),
                // Update tools
                'add_line_items' => $this->toolAddLineItems($arguments),
                'update_line_item' => $this->toolUpdateLineItem($arguments),
                'remove_line_item' => $this->toolRemoveLineItem($arguments),
                'update_requisition' => $this->toolUpdateRequisition($arguments),
                // Delete tools
                'delete_requisition' => $this->toolDeleteRequisition($arguments),
                // Visualization tools
                'get_job_summary' => $this->toolGetJobSummary($arguments),
                // DPC tools
                'get_dpc_summary' => $this->executeAndLogDpc('get_dpc_summary', $arguments),
                'get_dpc_trend' => $this->executeAndLogDpc('get_dpc_trend', $arguments),
                // Image generation tools
                'generate_image' => $this->toolGenerateImage($arguments),
                // Legacy
                'list_materials' => $this->toolSearchMaterials($arguments),
                default => json_encode(['error' => "Unknown tool: {$name}"]),
            };
        } catch (Throwable $e) {
            Log::error('Tool execution error', ['tool' => $name, 'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);

            return json_encode(['error' => "Failed to execute {$name}: ".$e->getMessage()]);
        }
    }

    private function toolReadRequisition(array $arguments): string
    {
        $requisitionId = (int) ($arguments['requisition_id'] ?? 0);

        $requisition = Requisition::query()
            ->with(['creator', 'location', 'supplier', 'lineItems'])
            ->find($requisitionId);

        if (! $requisition) {
            return json_encode(['error' => "No requisition found with ID {$requisitionId}"]);
        }

        $payload = [
            'id' => $requisition->id,
            'status' => $requisition->status ?? null,
            'date_required' => $requisition->date_required ?? null,
            'delivery_contact' => $requisition->delivery_contact ?? null,
            'requested_by' => $requisition->requested_by ?? null,
            'deliver_to' => $requisition->deliver_to ?? null,
            'order_reference' => $requisition->order_reference ?? null,
            'po_number' => $requisition->po_number ?? null,
            'created_at' => optional($requisition->created_at)->toDateTimeString(),
            'created_by' => optional($requisition->creator)->only(['id', 'name', 'email']),
            'location' => $requisition->location ? [
                'id' => $requisition->location->id,
                'name' => $requisition->location->name,
            ] : null,
            'supplier' => $requisition->supplier ? [
                'id' => $requisition->supplier->id,
                'name' => $requisition->supplier->name,
            ] : null,
            'total' => (float) ($requisition->total ?? 0),
            'lines' => $requisition->lineItems ? $requisition->lineItems->map(fn ($line) => [
                'id' => $line->id,
                'serial_number' => $line->serial_number ?? null,
                'code' => $line->code ?? null,
                'description' => $line->description ?? null,
                'qty' => (float) ($line->qty ?? 0),
                'unit_cost' => (float) ($line->unit_cost ?? 0),
                'total_cost' => (float) ($line->total_cost ?? (($line->qty ?? 0) * ($line->unit_cost ?? 0))),
                'cost_code' => $line->cost_code ?? null,
                'price_list' => $line->price_list ?? null,
            ])->values()->all() : [],
        ];

        return json_encode($payload, JSON_PRETTY_PRINT);
    }

    private function toolSearchRequisitions(array $arguments): string
    {
        $query = Requisition::query()->with(['location', 'supplier', 'creator', 'lineItems']);

        if (! empty($arguments['status'])) {
            $query->where('status', $arguments['status']);
        }

        if (! empty($arguments['location_id'])) {
            $query->where('project_number', $arguments['location_id']);
        }

        if (! empty($arguments['supplier_id'])) {
            $query->where('supplier_number', $arguments['supplier_id']);
        }

        if (! empty($arguments['po_number'])) {
            $query->where('po_number', 'like', '%'.$arguments['po_number'].'%');
        }

        if (! empty($arguments['date_from'])) {
            $query->whereDate('created_at', '>=', $arguments['date_from']);
        }

        if (! empty($arguments['date_to'])) {
            $query->whereDate('created_at', '<=', $arguments['date_to']);
        }

        if (! empty($arguments['search'])) {
            $search = $arguments['search'];
            $query->where(function ($q) use ($search) {
                $q->where('id', 'like', "%{$search}%")
                    ->orWhere('order_reference', 'like', "%{$search}%")
                    ->orWhere('po_number', 'like', "%{$search}%")
                    ->orWhere('requested_by', 'like', "%{$search}%");
            });
        }

        $limit = min((int) ($arguments['limit'] ?? 10), 50);

        $requisitions = $query->orderBy('created_at', 'desc')->limit($limit)->get();

        $results = $requisitions->map(fn ($req) => [
            'id' => $req->id,
            'status' => $req->status,
            'po_number' => $req->po_number,
            'location' => optional($req->location)->name,
            'supplier' => optional($req->supplier)->name,
            'total' => (float) ($req->total ?? 0),
            'line_count' => $req->lineItems->count(),
            'date_required' => $req->date_required,
            'created_at' => optional($req->created_at)->toDateTimeString(),
            'requested_by' => $req->requested_by,
        ])->all();

        return json_encode(['requisitions' => $results, 'count' => count($results)], JSON_PRETTY_PRINT);
    }

    private function toolGetRequisitionStats(array $arguments): string
    {
        $dateFrom = $arguments['date_from'] ?? Carbon::today()->toDateString();
        $dateTo = $arguments['date_to'] ?? Carbon::today()->toDateString();

        $query = Requisition::query()
            ->whereDate('created_at', '>=', $dateFrom)
            ->whereDate('created_at', '<=', $dateTo);

        if (! empty($arguments['location_id'])) {
            $query->where('project_number', $arguments['location_id']);
        }

        if (! empty($arguments['supplier_id'])) {
            $query->where('supplier_number', $arguments['supplier_id']);
        }

        $requisitions = $query->with('lineItems')->get();

        $stats = [
            'date_range' => ['from' => $dateFrom, 'to' => $dateTo],
            'total_requisitions' => $requisitions->count(),
            'by_status' => $requisitions->groupBy('status')->map->count()->toArray(),
            'total_value' => $requisitions->sum('total'),
            'total_line_items' => $requisitions->sum(fn ($r) => $r->lineItems->count()),
            'requisitions' => $requisitions->map(fn ($r) => [
                'id' => $r->id,
                'status' => $r->status,
                'total' => (float) $r->total,
                'line_count' => $r->lineItems->count(),
            ])->values()->all(),
        ];

        return json_encode($stats, JSON_PRETTY_PRINT);
    }

    private function toolListLocations(array $arguments): string
    {
        $query = Location::query();

        if (! empty($arguments['search'])) {
            $search = $arguments['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('external_id', 'like', "%{$search}%");
            });
        }

        $locations = $query->orderBy('name')->limit(50)->get(['id', 'name', 'external_id']);

        return json_encode(['locations' => $locations->toArray(), 'count' => $locations->count()], JSON_PRETTY_PRINT);
    }

    private function toolListSuppliers(array $arguments): string
    {
        $query = Supplier::query();

        if (! empty($arguments['search'])) {
            $search = $arguments['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        $suppliers = $query->orderBy('name')->limit(50)->get(['id', 'name', 'code']);

        return json_encode(['suppliers' => $suppliers->toArray(), 'count' => $suppliers->count()], JSON_PRETTY_PRINT);
    }

    private function toolSearchMaterials(array $arguments): string
    {
        $query = MaterialItem::query()->with('costCode');
        $locationId = $arguments['location_id'] ?? null;

        if (! empty($arguments['supplier_id'])) {
            $query->where('supplier_id', $arguments['supplier_id']);
        }

        if (! empty($arguments['search'])) {
            $search = $arguments['search'];
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $limit = min((int) ($arguments['limit'] ?? 20), 100);
        $materials = $query->orderBy('description')->limit($limit)->get();

        // Get location-specific pricing if location_id provided
        $locationPrices = [];
        if ($locationId) {
            $locationPrices = DB::table('location_item_pricing')
                ->where('location_id', $locationId)
                ->whereIn('material_item_id', $materials->pluck('id'))
                ->pluck('unit_cost_override', 'material_item_id')
                ->toArray();
        }

        $results = $materials->map(function ($item) use ($locationPrices) {
            $hasLocationPrice = isset($locationPrices[$item->id]);
            $unitCost = $hasLocationPrice ? $locationPrices[$item->id] : $item->unit_cost;

            return [
                'id' => $item->id,
                'code' => $item->code,
                'description' => $item->description,
                'unit' => $item->unit,
                'unit_cost' => (float) $unitCost,
                'price_list' => $hasLocationPrice ? 'location_price' : 'base_price',
                'cost_code' => $item->costCode?->code,
            ];
        })->all();

        return json_encode(['materials' => $results, 'count' => count($results)], JSON_PRETTY_PRINT);
    }

    private function toolGetMaterialPrice(array $arguments): string
    {
        $materialCode = $arguments['material_code'] ?? '';
        $locationId = (int) ($arguments['location_id'] ?? 0);

        $item = MaterialItem::with('costCode')->where('code', $materialCode)->first();

        if (! $item) {
            return json_encode(['error' => "Material with code '{$materialCode}' not found"]);
        }

        // Check for location-specific pricing
        $locationPrice = DB::table('location_item_pricing')
            ->join('locations', 'location_item_pricing.location_id', '=', 'locations.id')
            ->where('material_item_id', $item->id)
            ->where('location_item_pricing.location_id', $locationId)
            ->select('locations.name as location_name', 'location_item_pricing.unit_cost_override')
            ->first();

        $result = [
            'id' => $item->id,
            'code' => $item->code,
            'description' => $item->description,
            'unit' => $item->unit,
            'unit_cost' => (float) ($locationPrice ? $locationPrice->unit_cost_override : $item->unit_cost),
            'price_list' => $locationPrice ? $locationPrice->location_name : 'base_price',
            'cost_code' => $item->costCode?->code,
        ];

        return json_encode($result, JSON_PRETTY_PRINT);
    }

    private function toolCreateRequisition(array $arguments): string
    {
        $locationId = (int) ($arguments['location_id'] ?? 0);
        $supplierId = (int) ($arguments['supplier_id'] ?? 0);
        $items = $arguments['items'] ?? [];

        // Validate location exists
        $location = Location::find($locationId);
        if (! $location) {
            return json_encode(['error' => "Location with ID {$locationId} not found"]);
        }

        // Validate supplier exists
        $supplier = Supplier::find($supplierId);
        if (! $supplier) {
            return json_encode(['error' => "Supplier with ID {$supplierId} not found"]);
        }

        if (empty($items)) {
            return json_encode(['error' => 'At least one line item is required']);
        }

        // Get current user
        $userId = auth()->id();
        $userName = auth()->user()?->name ?? 'AI Assistant';

        // Create requisition
        $requisition = Requisition::create([
            'project_number' => $locationId,
            'supplier_number' => $supplierId,
            'date_required' => Carbon::parse($arguments['date_required'] ?? Carbon::tomorrow())->toDateString(),
            'delivery_contact' => $arguments['delivery_contact'] ?? null,
            'requested_by' => $arguments['requested_by'] ?? $userName,
            'deliver_to' => $arguments['deliver_to'] ?? $location->name,
            'order_reference' => $arguments['order_reference'] ?? null,
            'status' => 'pending',
            'created_by' => $userId,
        ]);

        // Get location-specific pricing for all material codes
        $materialCodes = collect($items)->pluck('code')->filter()->unique()->values()->all();
        $materialItems = MaterialItem::with('costCode')
            ->whereIn('code', $materialCodes)
            ->get()
            ->keyBy('code');

        $locationPrices = DB::table('location_item_pricing')
            ->where('location_id', $locationId)
            ->whereIn('material_item_id', $materialItems->pluck('id'))
            ->pluck('unit_cost_override', 'material_item_id')
            ->toArray();

        // Create line items
        $lineNumber = 1;
        $createdLines = [];
        foreach ($items as $item) {
            $materialCode = $item['code'] ?? null;
            $material = $materialCode ? ($materialItems[$materialCode] ?? null) : null;

            // Determine unit cost
            $unitCost = $item['unit_cost'] ?? null;
            $priceList = 'manual';

            if ($unitCost === null && $material) {
                $hasLocationPrice = isset($locationPrices[$material->id]);
                $unitCost = $hasLocationPrice ? $locationPrices[$material->id] : $material->unit_cost;
                $priceList = $hasLocationPrice ? $location->name : 'base_price';
            }

            $unitCost = (float) ($unitCost ?? 0);
            $qty = (float) ($item['qty'] ?? 1);
            $totalCost = $qty * $unitCost;

            $lineItem = RequisitionLineItem::create([
                'requisition_id' => $requisition->id,
                'serial_number' => $lineNumber++,
                'code' => $materialCode ?? null,
                'description' => $item['description'] ?? ($material?->description ?? 'Item'),
                'qty' => $qty,
                'unit_cost' => $unitCost,
                'total_cost' => $totalCost,
                'cost_code' => $item['cost_code'] ?? ($material?->costCode?->code ?? null),
                'price_list' => $priceList,
            ]);

            $createdLines[] = [
                'id' => $lineItem->id,
                'code' => $lineItem->code,
                'description' => $lineItem->description,
                'qty' => $lineItem->qty,
                'unit_cost' => $lineItem->unit_cost,
                'total_cost' => $lineItem->total_cost,
            ];
        }

        // Reload to get total
        $requisition->load(['location', 'supplier', 'lineItems']);

        return json_encode([
            'success' => true,
            'message' => 'Requisition created successfully',
            'requisition' => [
                'id' => $requisition->id,
                'status' => $requisition->status,
                'location' => $location->name,
                'supplier' => $supplier->name,
                'date_required' => $requisition->date_required,
                'requested_by' => $requisition->requested_by,
                'total' => (float) $requisition->total,
                'line_count' => count($createdLines),
                'lines' => $createdLines,
            ],
        ], JSON_PRETTY_PRINT);
    }

    private function toolAddLineItems(array $arguments): string
    {
        $requisitionId = (int) ($arguments['requisition_id'] ?? 0);
        $items = $arguments['items'] ?? [];

        $requisition = Requisition::with(['location', 'supplier', 'lineItems'])->find($requisitionId);

        if (! $requisition) {
            return json_encode(['error' => "Requisition with ID {$requisitionId} not found"]);
        }

        if ($requisition->status !== 'pending') {
            return json_encode(['error' => "Cannot modify requisition with status '{$requisition->status}'. Only pending requisitions can be modified."]);
        }

        if (empty($items)) {
            return json_encode(['error' => 'At least one line item is required']);
        }

        $locationId = $requisition->project_number;

        // Get location-specific pricing
        $materialCodes = collect($items)->pluck('code')->filter()->unique()->values()->all();
        $materialItems = MaterialItem::with('costCode')
            ->whereIn('code', $materialCodes)
            ->get()
            ->keyBy('code');

        $locationPrices = DB::table('location_item_pricing')
            ->where('location_id', $locationId)
            ->whereIn('material_item_id', $materialItems->pluck('id'))
            ->pluck('unit_cost_override', 'material_item_id')
            ->toArray();

        // Get next serial number
        $maxSerial = $requisition->lineItems->max('serial_number') ?? 0;
        $lineNumber = $maxSerial + 1;

        $createdLines = [];
        foreach ($items as $item) {
            $materialCode = $item['code'] ?? null;
            $material = $materialCode ? ($materialItems[$materialCode] ?? null) : null;

            $unitCost = $item['unit_cost'] ?? null;
            $priceList = 'manual';

            if ($unitCost === null && $material) {
                $hasLocationPrice = isset($locationPrices[$material->id]);
                $unitCost = $hasLocationPrice ? $locationPrices[$material->id] : $material->unit_cost;
                $priceList = $hasLocationPrice ? ($requisition->location?->name ?? 'location_price') : 'base_price';
            }

            $unitCost = (float) ($unitCost ?? 0);
            $qty = (float) ($item['qty'] ?? 1);
            $totalCost = $qty * $unitCost;

            $lineItem = RequisitionLineItem::create([
                'requisition_id' => $requisition->id,
                'serial_number' => $lineNumber++,
                'code' => $materialCode,
                'description' => $item['description'] ?? ($material?->description ?? 'Item'),
                'qty' => $qty,
                'unit_cost' => $unitCost,
                'total_cost' => $totalCost,
                'cost_code' => $item['cost_code'] ?? ($material?->costCode?->code ?? null),
                'price_list' => $priceList,
            ]);

            $createdLines[] = [
                'id' => $lineItem->id,
                'code' => $lineItem->code,
                'description' => $lineItem->description,
                'qty' => $lineItem->qty,
                'unit_cost' => $lineItem->unit_cost,
                'total_cost' => $lineItem->total_cost,
            ];
        }

        $requisition->refresh();

        return json_encode([
            'success' => true,
            'message' => count($createdLines).' line item(s) added',
            'requisition_id' => $requisition->id,
            'new_total' => (float) $requisition->total,
            'total_lines' => $requisition->lineItems->count(),
            'added_lines' => $createdLines,
        ], JSON_PRETTY_PRINT);
    }

    private function toolUpdateLineItem(array $arguments): string
    {
        $lineItemId = (int) ($arguments['line_item_id'] ?? 0);

        $lineItem = RequisitionLineItem::with('requisition')->find($lineItemId);

        if (! $lineItem) {
            return json_encode(['error' => "Line item with ID {$lineItemId} not found"]);
        }

        if ($lineItem->requisition->status !== 'pending') {
            return json_encode(['error' => "Cannot modify line item on requisition with status '{$lineItem->requisition->status}'"]);
        }

        $updates = [];

        if (isset($arguments['qty'])) {
            $lineItem->qty = (float) $arguments['qty'];
            $updates[] = 'qty';
        }

        if (isset($arguments['unit_cost'])) {
            $lineItem->unit_cost = (float) $arguments['unit_cost'];
            $updates[] = 'unit_cost';
        }

        if (isset($arguments['cost_code'])) {
            $lineItem->cost_code = $arguments['cost_code'];
            $updates[] = 'cost_code';
        }

        // Recalculate total
        $lineItem->total_cost = $lineItem->qty * $lineItem->unit_cost;
        $lineItem->save();

        return json_encode([
            'success' => true,
            'message' => 'Line item updated',
            'updated_fields' => $updates,
            'line_item' => [
                'id' => $lineItem->id,
                'code' => $lineItem->code,
                'description' => $lineItem->description,
                'qty' => (float) $lineItem->qty,
                'unit_cost' => (float) $lineItem->unit_cost,
                'total_cost' => (float) $lineItem->total_cost,
                'cost_code' => $lineItem->cost_code,
            ],
            'requisition_new_total' => (float) $lineItem->requisition->fresh()->total,
        ], JSON_PRETTY_PRINT);
    }

    private function toolRemoveLineItem(array $arguments): string
    {
        $lineItemId = (int) ($arguments['line_item_id'] ?? 0);

        $lineItem = RequisitionLineItem::with('requisition')->find($lineItemId);

        if (! $lineItem) {
            return json_encode(['error' => "Line item with ID {$lineItemId} not found"]);
        }

        if ($lineItem->requisition->status !== 'pending') {
            return json_encode(['error' => "Cannot remove line item from requisition with status '{$lineItem->requisition->status}'"]);
        }

        $requisitionId = $lineItem->requisition_id;
        $removedItem = [
            'id' => $lineItem->id,
            'code' => $lineItem->code,
            'description' => $lineItem->description,
        ];

        $lineItem->delete();

        $requisition = Requisition::with('lineItems')->find($requisitionId);

        return json_encode([
            'success' => true,
            'message' => 'Line item removed',
            'removed_item' => $removedItem,
            'requisition_id' => $requisitionId,
            'remaining_lines' => $requisition->lineItems->count(),
            'new_total' => (float) $requisition->total,
        ], JSON_PRETTY_PRINT);
    }

    private function toolUpdateRequisition(array $arguments): string
    {
        $requisitionId = (int) ($arguments['requisition_id'] ?? 0);

        $requisition = Requisition::find($requisitionId);

        if (! $requisition) {
            return json_encode(['error' => "Requisition with ID {$requisitionId} not found"]);
        }

        if ($requisition->status !== 'pending') {
            return json_encode(['error' => "Cannot modify requisition with status '{$requisition->status}'. Only pending requisitions can be modified."]);
        }

        $updates = [];

        if (isset($arguments['date_required'])) {
            $requisition->date_required = Carbon::parse($arguments['date_required'])->toDateString();
            $updates[] = 'date_required';
        }

        if (isset($arguments['requested_by'])) {
            $requisition->requested_by = $arguments['requested_by'];
            $updates[] = 'requested_by';
        }

        if (isset($arguments['delivery_contact'])) {
            $requisition->delivery_contact = $arguments['delivery_contact'];
            $updates[] = 'delivery_contact';
        }

        if (isset($arguments['deliver_to'])) {
            $requisition->deliver_to = $arguments['deliver_to'];
            $updates[] = 'deliver_to';
        }

        if (isset($arguments['order_reference'])) {
            $requisition->order_reference = $arguments['order_reference'];
            $updates[] = 'order_reference';
        }

        $requisition->save();

        return json_encode([
            'success' => true,
            'message' => 'Requisition updated',
            'updated_fields' => $updates,
            'requisition' => [
                'id' => $requisition->id,
                'date_required' => $requisition->date_required,
                'requested_by' => $requisition->requested_by,
                'delivery_contact' => $requisition->delivery_contact,
                'deliver_to' => $requisition->deliver_to,
                'order_reference' => $requisition->order_reference,
            ],
        ], JSON_PRETTY_PRINT);
    }

    private function toolDeleteRequisition(array $arguments): string
    {
        $requisitionId = (int) ($arguments['requisition_id'] ?? 0);
        $confirm = (bool) ($arguments['confirm'] ?? false);

        if (! $confirm) {
            return json_encode(['error' => 'Deletion not confirmed. Set confirm to true to delete.']);
        }

        $requisition = Requisition::with('lineItems')->find($requisitionId);

        if (! $requisition) {
            return json_encode(['error' => "Requisition with ID {$requisitionId} not found"]);
        }

        if ($requisition->status !== 'pending') {
            return json_encode(['error' => "Cannot delete requisition with status '{$requisition->status}'. Only pending requisitions can be deleted."]);
        }

        $summary = [
            'id' => $requisition->id,
            'line_count' => $requisition->lineItems->count(),
            'total' => (float) $requisition->total,
        ];

        // Delete line items first
        $requisition->lineItems()->delete();
        $requisition->delete();

        return json_encode([
            'success' => true,
            'message' => 'Requisition deleted',
            'deleted_requisition' => $summary,
        ], JSON_PRETTY_PRINT);
    }

    private function toolGetJobSummary(array $arguments): string
    {
        $query = JobSummary::query();

        // Fuzzy search by project name via Location relationship
        if (! empty($arguments['search'])) {
            $search = $arguments['search'];
            $query->where(function ($q) use ($search) {
                $q->where('job_number', 'like', '%'.$search.'%')
                  ->orWhereHas('location', function ($loc) use ($search) {
                      $loc->where('name', 'like', '%'.$search.'%')
                          ->orWhere('fully_qualified_name', 'like', '%'.$search.'%');
                  });
            });
        }

        if (! empty($arguments['job_number'])) {
            $query->where('job_number', 'like', '%'.$arguments['job_number'].'%');
        }

        if (! empty($arguments['status'])) {
            $query->where('status', $arguments['status']);
        }

        if (! empty($arguments['company_code'])) {
            $query->where('company_code', $arguments['company_code']);
        }

        $limit = min((int) ($arguments['limit'] ?? 20), 100);
        $includeChart = (bool) ($arguments['include_chart'] ?? false);

        // Eager load location name for context
        $jobs = $query->with('location:id,name,external_id')->orderBy('job_number')->limit($limit)->get();

        if ($jobs->isEmpty()) {
            return json_encode(['error' => 'No job summaries found matching the criteria']);
        }

        $results = $jobs->map(fn ($job) => [
            'job_number' => $job->job_number,
            'project_name' => $job->location?->name,
            'company_code' => $job->company_code,
            'status' => $job->status,
            'start_date' => optional($job->start_date)->toDateString(),
            'estimated_end_date' => optional($job->estimated_end_date)->toDateString(),
            'actual_end_date' => optional($job->actual_end_date)->toDateString(),
            'original_estimate_cost' => (float) ($job->original_estimate_cost ?? 0),
            'current_estimate_cost' => (float) ($job->current_estimate_cost ?? 0),
            'original_estimate_revenue' => (float) ($job->original_estimate_revenue ?? 0),
            'current_estimate_revenue' => (float) ($job->current_estimate_revenue ?? 0),
            'over_under_billing' => (float) ($job->over_under_billing ?? 0),
        ])->all();

        $response = [
            'jobs' => $results,
            'count' => count($results),
            'summary' => [
                'total_original_cost' => collect($results)->sum('original_estimate_cost'),
                'total_current_cost' => collect($results)->sum('current_estimate_cost'),
                'total_original_revenue' => collect($results)->sum('original_estimate_revenue'),
                'total_current_revenue' => collect($results)->sum('current_estimate_revenue'),
                'total_over_under_billing' => collect($results)->sum('over_under_billing'),
            ],
        ];

        // Add chart-formatted data if requested
        if ($includeChart) {
            $response['chart_data'] = [
                'type' => 'bar',
                'title' => 'Job Summary - Cost vs Revenue',
                'labels' => collect($results)->pluck('job_number')->all(),
                'datasets' => [
                    [
                        'label' => 'Current Est. Cost',
                        'data' => collect($results)->pluck('current_estimate_cost')->all(),
                        'backgroundColor' => 'rgba(239, 68, 68, 0.7)',
                    ],
                    [
                        'label' => 'Current Est. Revenue',
                        'data' => collect($results)->pluck('current_estimate_revenue')->all(),
                        'backgroundColor' => 'rgba(34, 197, 94, 0.7)',
                    ],
                ],
            ];
        }

        return json_encode($response, JSON_PRETTY_PRINT);
    }

    /**
     * Execute a DPC tool and log the full result for debugging.
     */
    private function executeAndLogDpc(string $toolName, array $arguments): string
    {
        $result = $toolName === 'get_dpc_summary'
            ? $this->toolGetDpcSummary($arguments)
            : $this->toolGetDpcTrend($arguments);

        Log::info('DPC tool result', [
            'tool' => $toolName,
            'arguments' => $arguments,
            'result_preview' => mb_substr($result, 0, 500),
        ]);

        return $result;
    }

    /**
     * Resolve a location from search text or location_id.
     * Returns the Location model or null.
     */
    private function resolveDpcLocation(array $arguments): ?Location
    {
        // Scope to SWCP projects only
        $swcpScope = fn ($query) => $query->whereHas('jobSummary', fn ($q) => $q->where('company_code', 'SWCP'));

        if (! empty($arguments['location_id'])) {
            return Location::where('id', (int) $arguments['location_id'])
                ->where($swcpScope)
                ->first();
        }

        if (! empty($arguments['search'])) {
            $search = $arguments['search'];

            return Location::where($swcpScope)
                ->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('fully_qualified_name', 'like', "%{$search}%")
                      ->orWhere('external_id', 'like', "%{$search}%");
                })
                ->first();
        }

        return null;
    }

    /**
     * Find the latest production upload for a location, or one matching a specific report_date.
     */
    private function resolveDpcUpload(int $locationId, ?string $reportDate = null): ?ProductionUpload
    {
        $query = ProductionUpload::where('location_id', $locationId);

        if ($reportDate) {
            $query->whereDate('report_date', $reportDate);
        }

        return $query->orderByDesc('report_date')->orderByDesc('created_at')->first();
    }

    /**
     * Apply fuzzy area/task filters to a production upload lines query.
     */
    private function applyDpcFilters($query, array $arguments): void
    {
        if (! empty($arguments['area'])) {
            $area = $arguments['area'];
            $query->where('area', 'like', "%{$area}%");
        }

        if (! empty($arguments['task'])) {
            $task = trim($arguments['task']);

            // Strip area prefixes the AI sometimes prepends (e.g. "LEVEL 06 Carpentry Noggings")
            // Try exact match first, then strip known area patterns
            $query->where(function ($q) use ($task) {
                $q->where('cost_code', 'like', "%{$task}%")
                  ->orWhere('code_description', 'like', "%{$task}%");

                // Also try without area-like prefix (LEVEL XX, GROUND, BASEMENT, PRELIM, etc.)
                $stripped = preg_replace('/^(LEVEL\s*\d+\s*(\(.*?\))?\s*[-—–]?\s*|GROUND\s*(\(.*?\))?\s*[-—–]?\s*|BASEMENT\s*(\(.*?\))?\s*[-—–]?\s*|PRELIM\s*[-—–]?\s*|MEZZANINE\s*(\(.*?\))?\s*[-—–]?\s*|ROOF\s*(\(.*?\))?\s*[-—–]?\s*)/i', '', $task);
                $stripped = trim($stripped, ' -—–');
                if ($stripped !== '' && $stripped !== $task) {
                    $q->orWhere('cost_code', 'like', "%{$stripped}%")
                      ->orWhere('code_description', 'like', "%{$stripped}%");
                }
            });
        }

        // Only apply percent filters when explicitly set to a meaningful value
        // The AI sometimes sends 0 or empty string for all optional params — ignore those
        if (isset($arguments['min_percent_complete']) && $arguments['min_percent_complete'] !== '' && $arguments['min_percent_complete'] !== null && (float) $arguments['min_percent_complete'] > 0) {
            $query->where('percent_complete', '>=', (float) $arguments['min_percent_complete']);
        }

        if (isset($arguments['max_percent_complete']) && $arguments['max_percent_complete'] !== '' && $arguments['max_percent_complete'] !== null && (float) $arguments['max_percent_complete'] > 0) {
            $query->where('percent_complete', '<=', (float) $arguments['max_percent_complete']);
        }
    }

    private function toolGetDpcSummary(array $arguments): string
    {
        // Sanitize: the AI often sends all optional params with empty/zero defaults — strip them
        foreach (['area', 'task', 'search', 'report_date', 'sort_by', 'sort_dir'] as $key) {
            if (isset($arguments[$key]) && ($arguments[$key] === '' || $arguments[$key] === null)) {
                unset($arguments[$key]);
            }
        }
        foreach (['location_id', 'limit'] as $key) {
            if (isset($arguments[$key]) && (int) $arguments[$key] === 0) {
                unset($arguments[$key]);
            }
        }

        // 1. Resolve location — always required, never mix projects
        $location = $this->resolveDpcLocation($arguments);

        if (! $location) {
            return json_encode(['error' => 'Could not find a matching project/location. Please specify a project name or location ID.']);
        }

        // 2. Resolve the upload (latest or specific date)
        $reportDate = $arguments['report_date'] ?? null;
        $upload = $this->resolveDpcUpload($location->id, $reportDate);

        if (! $upload) {
            $msg = $reportDate
                ? "No DPC data was uploaded for '{$location->name}' on {$reportDate}."
                : "No DPC data has been uploaded for '{$location->name}'. Data is not present for this project.";

            return json_encode(['error' => $msg]);
        }

        // 3. Build filtered query on the single upload
        $query = ProductionUploadLine::where('production_upload_id', $upload->id);
        $this->applyDpcFilters($query, $arguments);

        // 4. Sorting
        $sortBy = $arguments['sort_by'] ?? 'actual_variance';
        $sortDir = $arguments['sort_dir'] ?? 'asc';
        $validSorts = ['actual_variance', 'used_hours', 'earned_hours', 'est_hours', 'projected_variance', 'projected_hours', 'percent_complete'];
        if (! in_array($sortBy, $validSorts)) {
            $sortBy = 'actual_variance';
        }
        $query->orderBy($sortBy, $sortDir);

        // 5. Limit
        $limit = min((int) ($arguments['limit'] ?? 20), 50);

        // Get total count before limiting (for summary)
        $totalQuery = ProductionUploadLine::where('production_upload_id', $upload->id);
        $this->applyDpcFilters($totalQuery, $arguments);
        $totalMatchingLines = $totalQuery->count();

        // If no results found with filters, suggest similar items
        if ($totalMatchingLines === 0 && (! empty($arguments['area']) || ! empty($arguments['task']))) {
            $suggestions = [];

            if (! empty($arguments['task'])) {
                $task = $arguments['task'];
                // Find distinct code_descriptions that partially match any word in the query
                $words = preg_split('/[\s_\-]+/', $task);
                $suggestQuery = ProductionUploadLine::where('production_upload_id', $upload->id);

                if (! empty($arguments['area'])) {
                    $area = $arguments['area'];
                    $suggestQuery->where('area', 'like', "%{$area}%");
                }

                $suggestQuery->where(function ($q) use ($words) {
                    foreach ($words as $word) {
                        if (strlen($word) >= 3) {
                            $q->orWhere('code_description', 'like', "%{$word}%")
                              ->orWhere('cost_code', 'like', "%{$word}%");
                        }
                    }
                });

                $suggestions = $suggestQuery
                    ->select('area', 'code_description', 'cost_code')
                    ->distinct()
                    ->limit(10)
                    ->get()
                    ->map(fn ($l) => "{$l->area} — {$l->code_description} ({$l->cost_code})")
                    ->values()
                    ->all();
            }

            // If word-based search found nothing, show all distinct items for the area
            if (empty($suggestions) && ! empty($arguments['area'])) {
                $area = $arguments['area'];
                $suggestions = ProductionUploadLine::where('production_upload_id', $upload->id)
                    ->where('area', 'like', "%{$area}%")
                    ->select('area', 'code_description', 'cost_code')
                    ->distinct()
                    ->limit(15)
                    ->get()
                    ->map(fn ($l) => "{$l->area} — {$l->code_description} ({$l->cost_code})")
                    ->values()
                    ->all();
            }

            // If still nothing, show all distinct areas
            if (empty($suggestions)) {
                $suggestions = ProductionUploadLine::where('production_upload_id', $upload->id)
                    ->select('area')
                    ->distinct()
                    ->orderBy('area')
                    ->limit(20)
                    ->pluck('area')
                    ->all();

                return json_encode([
                    'no_match' => true,
                    'message' => "No items matched your filter. Here are the available areas in {$location->name}:",
                    'available_areas' => $suggestions,
                    'tip' => 'Try filtering by one of these areas, or use a different task/cost code keyword.',
                ], JSON_PRETTY_PRINT);
            }

            return json_encode([
                'no_match' => true,
                'message' => "No exact match found for your filter. Did you mean one of these?",
                'suggestions' => $suggestions,
                'tip' => 'Try using one of the suggested cost codes or descriptions above.',
            ], JSON_PRETTY_PRINT);
        }

        // Aggregate summary across ALL matching lines (not just the limited set)
        $aggregates = (clone $totalQuery)->selectRaw('
            SUM(est_hours) as total_est_hours,
            SUM(earned_hours) as total_earned_hours,
            SUM(used_hours) as total_used_hours,
            SUM(actual_variance) as total_actual_variance,
            SUM(remaining_hours) as total_remaining_hours,
            SUM(projected_hours) as total_projected_hours,
            SUM(projected_variance) as total_projected_variance
        ')->first();

        $totalEstHours = (float) ($aggregates->total_est_hours ?? 0);
        $totalEarnedHours = (float) ($aggregates->total_earned_hours ?? 0);

        // 6. Fetch limited rows
        $lines = $query->limit($limit)->get();

        $items = $lines->map(fn ($line) => [
            'area' => $line->area,
            'code_description' => $line->code_description,
            'cost_code' => $line->cost_code,
            'est_hours' => round($line->est_hours, 2),
            'percent_complete' => round($line->percent_complete, 1),
            'earned_hours' => round($line->earned_hours, 2),
            'used_hours' => round($line->used_hours, 2),
            'actual_variance' => round($line->actual_variance, 2),
            'variance_pct' => $line->est_hours > 0
                ? round(($line->actual_variance / $line->est_hours) * 100, 1)
                : 0,
            'remaining_hours' => round($line->remaining_hours, 2),
            'projected_hours' => round($line->projected_hours, 2),
            'projected_variance' => round($line->projected_variance, 2),
        ])->all();

        // When sorted by variance, also include the opposite extreme so the AI can answer
        // "most negative AND most positive" in a single call
        if (($arguments['sort_by'] ?? '') === 'actual_variance') {
            $oppositeDir = $sortDir === 'asc' ? 'desc' : 'asc';
            $oppositeQuery = ProductionUploadLine::where('production_upload_id', $upload->id);
            $this->applyDpcFilters($oppositeQuery, $arguments);
            $oppositeLines = $oppositeQuery->orderBy('actual_variance', $oppositeDir)->limit($limit)->get();

            $oppositeItems = $oppositeLines->map(fn ($line) => [
                'area' => $line->area,
                'code_description' => $line->code_description,
                'cost_code' => $line->cost_code,
                'est_hours' => round($line->est_hours, 2),
                'percent_complete' => round($line->percent_complete, 1),
                'earned_hours' => round($line->earned_hours, 2),
                'used_hours' => round($line->used_hours, 2),
                'actual_variance' => round($line->actual_variance, 2),
                'variance_pct' => $line->est_hours > 0
                    ? round(($line->actual_variance / $line->est_hours) * 100, 1)
                    : 0,
                'remaining_hours' => round($line->remaining_hours, 2),
                'projected_hours' => round($line->projected_hours, 2),
                'projected_variance' => round($line->projected_variance, 2),
            ])->all();
        }

        $hasFilters = ! empty($arguments['area']) || ! empty($arguments['task'])
            || isset($arguments['min_percent_complete']) || isset($arguments['max_percent_complete']);

        $response = [
            'IMPORTANT' => 'Use ONLY the summary totals below when reporting to the user. Do NOT sum or re-calculate from the items list — items are a limited subset.',
            'project' => $location->name,
            'location_id' => $location->id,
            'report_date' => $upload->report_date->toDateString(),
            'uploaded_at' => $upload->created_at->toDateTimeString(),
            'filters_applied' => array_filter([
                'area' => $arguments['area'] ?? null,
                'task' => $arguments['task'] ?? null,
                'min_percent_complete' => $arguments['min_percent_complete'] ?? null,
                'max_percent_complete' => $arguments['max_percent_complete'] ?? null,
            ]),
            'summary' => [
                'total_matching_items' => $totalMatchingLines,
                'showing' => $hasFilters ? count($items) : $totalMatchingLines,
                'total_est_hours' => round($totalEstHours, 2),
                'total_earned_hours' => round($totalEarnedHours, 2),
                'total_used_hours' => round((float) ($aggregates->total_used_hours ?? 0), 2),
                'overall_percent_complete' => $totalEstHours > 0
                    ? round(($totalEarnedHours / $totalEstHours) * 100, 1)
                    : 0,
                'total_actual_variance' => round((float) ($aggregates->total_actual_variance ?? 0), 2),
                'total_remaining_hours' => round((float) ($aggregates->total_remaining_hours ?? 0), 2),
                'total_projected_hours' => round((float) ($aggregates->total_projected_hours ?? 0), 2),
                'total_projected_variance' => round((float) ($aggregates->total_projected_variance ?? 0), 2),
                'status' => ((float) ($aggregates->total_actual_variance ?? 0)) >= 0 ? 'UNDER budget (favorable)' : 'OVER budget (unfavorable)',
            ],
        ];

        // Only include individual items when filters are applied or explicitly sorted/limited
        // This prevents the AI from ignoring the summary and re-calculating from the limited items list
        if ($hasFilters || isset($arguments['sort_by']) || isset($arguments['limit'])) {
            $label = $sortDir === 'asc' ? 'worst_variance_items' : 'best_variance_items';
            $response[$label] = $items;

            // Include opposite extreme when sorting by variance
            if (isset($oppositeItems) && ! empty($oppositeItems)) {
                $oppositeLabel = $sortDir === 'asc' ? 'best_variance_items' : 'worst_variance_items';
                $response[$oppositeLabel] = $oppositeItems;
            }
        }

        return json_encode($response, JSON_PRETTY_PRINT);
    }

    private function toolGetDpcTrend(array $arguments): string
    {
        // Sanitize empty defaults sent by AI
        foreach (['area', 'task', 'search'] as $key) {
            if (isset($arguments[$key]) && ($arguments[$key] === '' || $arguments[$key] === null)) {
                unset($arguments[$key]);
            }
        }
        foreach (['location_id', 'limit_reports'] as $key) {
            if (isset($arguments[$key]) && (int) $arguments[$key] === 0) {
                unset($arguments[$key]);
            }
        }
        // 1. Resolve location — always required, never mix projects
        $location = $this->resolveDpcLocation($arguments);

        if (! $location) {
            return json_encode(['error' => 'Could not find a matching project/location. Please specify a project name or location ID.']);
        }

        // 2. Get recent uploads for this location
        $limitReports = min((int) ($arguments['limit_reports'] ?? 5), 10);

        $uploads = ProductionUpload::where('location_id', $location->id)
            ->orderByDesc('report_date')
            ->limit($limitReports)
            ->get();

        if ($uploads->isEmpty()) {
            return json_encode(['error' => "No DPC data has been uploaded for '{$location->name}'. Data is not present for this project."]);
        }

        if ($uploads->count() < 2) {
            return json_encode(['error' => "Only one DPC report exists for '{$location->name}' (dated {$uploads->first()->report_date->toDateString()}). Trending requires at least 2 reports to compare."]);
        }

        // 3. For each upload, get matching lines and aggregate
        $trend = [];

        foreach ($uploads->reverse() as $upload) {
            $query = ProductionUploadLine::where('production_upload_id', $upload->id);
            $this->applyDpcFilters($query, $arguments);

            $aggregates = (clone $query)->selectRaw('
                COUNT(*) as item_count,
                SUM(est_hours) as total_est_hours,
                SUM(earned_hours) as total_earned_hours,
                SUM(used_hours) as total_used_hours,
                SUM(actual_variance) as total_actual_variance,
                SUM(projected_hours) as total_projected_hours,
                SUM(projected_variance) as total_projected_variance
            ')->first();

            $totalEstHours = (float) ($aggregates->total_est_hours ?? 0);
            $totalEarnedHours = (float) ($aggregates->total_earned_hours ?? 0);

            $trend[] = [
                'report_date' => $upload->report_date->toDateString(),
                'items_matched' => (int) ($aggregates->item_count ?? 0),
                'est_hours' => round($totalEstHours, 2),
                'earned_hours' => round($totalEarnedHours, 2),
                'used_hours' => round((float) ($aggregates->total_used_hours ?? 0), 2),
                'percent_complete' => $totalEstHours > 0
                    ? round(($totalEarnedHours / $totalEstHours) * 100, 1)
                    : 0,
                'actual_variance' => round((float) ($aggregates->total_actual_variance ?? 0), 2),
                'projected_hours' => round((float) ($aggregates->total_projected_hours ?? 0), 2),
                'projected_variance' => round((float) ($aggregates->total_projected_variance ?? 0), 2),
            ];
        }

        // 4. Compute deltas between first and last
        $first = $trend[0];
        $last = $trend[count($trend) - 1];

        $movement = [
            'period' => "{$first['report_date']} to {$last['report_date']}",
            'earned_hours_change' => round($last['earned_hours'] - $first['earned_hours'], 2),
            'used_hours_change' => round($last['used_hours'] - $first['used_hours'], 2),
            'variance_change' => round($last['actual_variance'] - $first['actual_variance'], 2),
            'percent_complete_change' => round($last['percent_complete'] - $first['percent_complete'], 1),
            'variance_direction' => ($last['actual_variance'] - $first['actual_variance']) >= 0 ? 'improving' : 'worsening',
        ];

        return json_encode([
            'project' => $location->name,
            'location_id' => $location->id,
            'filters_applied' => array_filter([
                'area' => $arguments['area'] ?? null,
                'task' => $arguments['task'] ?? null,
            ]),
            'reports_compared' => count($trend),
            'trend' => $trend,
            'movement' => $movement,
        ], JSON_PRETTY_PRINT);
    }

    private function toolGenerateImage(array $arguments): string
    {
        $prompt = $arguments['prompt'] ?? '';

        if (empty($prompt)) {
            return json_encode(['error' => 'A prompt is required to generate an image']);
        }

        $size = $arguments['size'] ?? '1024x1024';
        $quality = $arguments['quality'] ?? 'standard';
        $style = $arguments['style'] ?? 'vivid';

        // Validate size
        if (! in_array($size, ['1024x1024', '1792x1024', '1024x1792'])) {
            $size = '1024x1024';
        }

        if (! in_array($quality, ['standard', 'hd'])) {
            $quality = 'standard';
        }

        if (! in_array($style, ['vivid', 'natural'])) {
            $style = 'vivid';
        }

        try {
            $apiKey = config('services.openai.api_key') ?: env('OPENAI_API_KEY') ?: env('VITE_OPEN_AI_API_KEY');

            if (! $apiKey) {
                return json_encode(['error' => 'OpenAI API key is not configured']);
            }

            $response = Http::withToken($apiKey)
                ->timeout(120)
                ->post('https://api.openai.com/v1/images/generations', [
                    'model' => 'dall-e-3',
                    'prompt' => $prompt,
                    'n' => 1,
                    'size' => $size,
                    'quality' => $quality,
                    'style' => $style,
                    'response_format' => 'url',
                ]);

            if ($response->failed()) {
                Log::error('DALL-E API error', [
                    'status' => $response->status(),
                    'body' => $response->json(),
                ]);

                return json_encode(['error' => 'Failed to generate image: '.($response->json()['error']['message'] ?? 'Unknown error')]);
            }

            $result = $response->json();

            if (empty($result['data'][0]['url'])) {
                return json_encode(['error' => 'No image URL returned from API']);
            }

            $imageUrl = $result['data'][0]['url'];
            $revisedPrompt = $result['data'][0]['revised_prompt'] ?? $prompt;

            return json_encode([
                'success' => true,
                'image_url' => $imageUrl,
                'revised_prompt' => $revisedPrompt,
                'size' => $size,
                'quality' => $quality,
                'style' => $style,
                'display_type' => 'generated_image',
            ], JSON_PRETTY_PRINT);

        } catch (Throwable $e) {
            Log::error('Image generation error', ['error' => $e->getMessage()]);

            return json_encode(['error' => 'Failed to generate image: '.$e->getMessage()]);
        }
    }
}
