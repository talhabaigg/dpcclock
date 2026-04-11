<?php

namespace App\Ai\Tools;

use App\Models\Location;
use App\Models\MaterialItem;
use App\Models\Supplier;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class UpdateRequisitionDraft implements Tool
{
    public function description(): Stringable|string
    {
        return <<<'DESC'
        Update the requisition draft form visible to the user. Call this tool whenever you have enough information to populate or update the order form.
        This does NOT save to database — it pushes the current draft state to the user's screen so they can review and edit before submitting.
        You can call this multiple times as the order evolves (e.g. after selecting a location, after adding items, after changing quantities).
        Always include ALL current items when updating — this replaces the entire draft, not a partial update.
        DESC;
    }

    public function handle(Request $request): Stringable|string
    {
        $draft = [
            'header' => [],
            'items' => [],
        ];

        // Resolve header fields
        $locationId = $request['location_id'] ?? null;
        $supplierId = $request['supplier_id'] ?? null;

        if ($locationId) {
            $location = Location::find($locationId);
            if ($location) {
                $draft['header']['location_id'] = $location->id;
                $draft['header']['location_name'] = $location->name;
            }
        }

        if ($supplierId) {
            $supplier = Supplier::find($supplierId);
            if ($supplier) {
                $draft['header']['supplier_id'] = $supplier->id;
                $draft['header']['supplier_name'] = $supplier->name;
            }
        }

        $draft['header']['date_required'] = $request['date_required'] ?? now()->addWeekdays(3)->format('Y-m-d');
        $draft['header']['delivery_contact'] = $request['delivery_contact'] ?? null;
        $draft['header']['requested_by'] = $request['requested_by'] ?? null;
        $draft['header']['deliver_to'] = $request['deliver_to'] ?? null;
        $draft['header']['order_reference'] = $request['order_reference'] ?? null;

        // Resolve items with pricing
        $items = $request['items'] ?? [];
        $resolvedItems = [];

        if (! empty($items)) {
            // Bulk-load material data for efficiency
            $codes = collect($items)->pluck('code')->filter()->unique()->values()->all();
            $materials = MaterialItem::with('costCode')
                ->whereIn('code', $codes)
                ->get()
                ->keyBy('code');

            $locationPrices = [];
            if ($locationId && $materials->isNotEmpty()) {
                $locationPrices = DB::table('location_item_pricing')
                    ->where('location_id', $locationId)
                    ->whereIn('material_item_id', $materials->pluck('id'))
                    ->get()
                    ->keyBy('material_item_id');
            }

            foreach ($items as $index => $item) {
                $code = $item['code'] ?? null;
                $material = $code ? ($materials[$code] ?? null) : null;

                $unitCost = $item['unit_cost'] ?? null;
                $priceList = '';
                $isLocked = false;

                if ($material) {
                    $locPrice = $locationPrices[$material->id] ?? null;
                    if ($locPrice) {
                        $unitCost = $unitCost ?? $locPrice->unit_cost_override;
                        $priceList = $location->name ?? 'location_price';
                        $isLocked = (bool) ($locPrice->is_locked ?? false);
                    } else {
                        $unitCost = $unitCost ?? $material->unit_cost;
                        $priceList = 'base_price';
                    }
                }

                $unitCost = (float) ($unitCost ?? 0);
                $qty = (float) ($item['qty'] ?? 1);

                $resolvedItems[] = [
                    'serial_number' => $index + 1,
                    'code' => $code ?? '',
                    'description' => $item['description'] ?? ($material?->description ?? ''),
                    'qty' => $qty,
                    'unit_cost' => $unitCost,
                    'total_cost' => round($qty * $unitCost, 2),
                    'cost_code' => $item['cost_code'] ?? ($material?->costCode?->code ?? ''),
                    'price_list' => $priceList,
                    'is_locked' => $isLocked,
                ];
            }
        }

        $draft['items'] = $resolvedItems;
        $draft['total'] = collect($resolvedItems)->sum('total_cost');

        return json_encode([
            'success' => true,
            'draft' => $draft,
        ], JSON_PRETTY_PRINT);
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'location_id' => $schema->integer()->description('The location/project ID (from search_locations)'),
            'supplier_id' => $schema->integer()->description('The supplier ID (from list_suppliers)'),
            'date_required' => $schema->string()->description('Required delivery date (YYYY-MM-DD). Defaults to 3 business days.'),
            'requested_by' => $schema->string()->description('Name of person requesting'),
            'delivery_contact' => $schema->string()->description('Contact person for delivery'),
            'deliver_to' => $schema->string()->description('Delivery address or location name'),
            'order_reference' => $schema->string()->description('Optional order reference (max 80 chars)'),
            'items' => $schema->array()->items(
                $schema->object([
                    'code' => $schema->string()->description('Material item code (from search_materials)'),
                    'description' => $schema->string()->description('Item description'),
                    'qty' => $schema->number()->description('Quantity to order')->required(),
                    'unit_cost' => $schema->number()->description('Unit cost override (auto-resolved if omitted)'),
                    'cost_code' => $schema->string()->description('Cost code'),
                ])
            )->description('All line items for the requisition'),
        ];
    }
}
