<?php

namespace App\Ai\Tools;

use App\Models\Location;
use App\Models\MaterialItem;
use App\Models\Requisition;
use App\Models\RequisitionLineItem;
use App\Models\Supplier;
use Carbon\Carbon;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class CreateRequisition implements Tool
{
    public function description(): Stringable|string
    {
        return <<<'DESC'
        Create a new requisition/purchase order with line items. Always confirm the order summary with the user before calling this tool.
        Automatically applies location-specific pricing when a material code is provided.
        Returns the created requisition ID and summary.
        DESC;
    }

    public function handle(Request $request): Stringable|string
    {
        $locationId = (int) $request['location_id'];
        $supplierId = (int) $request['supplier_id'];
        $items = $request['items'] ?? [];

        // Validate location
        $location = Location::find($locationId);
        if (! $location) {
            return json_encode(['error' => "Location with ID {$locationId} not found"]);
        }

        // Validate supplier
        $supplier = Supplier::find($supplierId);
        if (! $supplier) {
            return json_encode(['error' => "Supplier with ID {$supplierId} not found"]);
        }

        if (empty($items)) {
            return json_encode(['error' => 'At least one line item is required']);
        }

        // Get current user
        $userName = auth()->user()?->name ?? 'AI Assistant';

        // Create requisition
        $requisition = Requisition::create([
            'project_number' => $locationId,
            'supplier_number' => $supplierId,
            'date_required' => Carbon::parse($request['date_required'] ?? now()->addWeekdays(3))->toDateString(),
            'delivery_contact' => $request['delivery_contact'] ?? null,
            'requested_by' => $request['requested_by'] ?? $userName,
            'deliver_to' => $request['deliver_to'] ?? $location->name,
            'order_reference' => $request['order_reference'] ?? null,
            'status' => 'pending',
        ]);

        // Resolve material codes to get pricing
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

            // Determine unit cost and price source
            $unitCost = $item['unit_cost'] ?? null;
            $priceList = 'manual';

            if ($material) {
                $hasLocationPrice = isset($locationPrices[$material->id]);

                if ($unitCost === null) {
                    $unitCost = $hasLocationPrice ? $locationPrices[$material->id] : $material->unit_cost;
                }

                // When material exists, price_list reflects the pricing source
                $priceList = $hasLocationPrice ? $location->name : 'base_price';
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
                'qty' => (float) $lineItem->qty,
                'unit_cost' => (float) $lineItem->unit_cost,
                'total_cost' => (float) $lineItem->total_cost,
                'cost_code' => $lineItem->cost_code,
                'price_list' => $lineItem->price_list,
            ];
        }

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
                'deliver_to' => $requisition->deliver_to,
                'total' => collect($createdLines)->sum('total_cost'),
                'line_count' => count($createdLines),
                'lines' => $createdLines,
            ],
        ], JSON_PRETTY_PRINT);
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'location_id' => $schema->integer()->description('The location/project ID')->required(),
            'supplier_id' => $schema->integer()->description('The supplier ID')->required(),
            'date_required' => $schema->string()->description('Required delivery date (YYYY-MM-DD). Defaults to 3 business days from today.'),
            'requested_by' => $schema->string()->description('Name of person requesting the order'),
            'delivery_contact' => $schema->string()->description('Contact person for delivery'),
            'deliver_to' => $schema->string()->description('Delivery address or location name'),
            'order_reference' => $schema->string()->description('Optional order reference (max 80 chars)'),
            'items' => $schema->array()->items(
                $schema->object([
                    'code' => $schema->string()->description('Material item code (from search_materials)'),
                    'description' => $schema->string()->description('Item description (auto-filled from material if code provided)'),
                    'qty' => $schema->number()->description('Quantity to order')->required(),
                    'unit_cost' => $schema->number()->description('Unit cost override (auto-resolved from material pricing if omitted)'),
                    'cost_code' => $schema->string()->description('Cost code (auto-filled from material if available)'),
                ])
            )->description('Line items to add to the requisition')->required(),
        ];
    }
}
