<?php

namespace App\Mcp\Tools;

use App\Models\MaterialItem;
use DB;
use Generator;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\Title;
use Laravel\Mcp\Server\Tools\ToolInputSchema;
use Laravel\Mcp\Server\Tools\ToolResult;

#[Title('List Material')]
class ListMaterial extends Tool
{
    /**
     * A description of the tool.
     */
    public function description(): string
    {
        return 'Use this tool to list all materials filtered by location, supplier, pass search term to look for matching item code or matching description.';
    }

    /**
     * The input schema of the tool.
     */
    public function schema(ToolInputSchema $schema): ToolInputSchema
    {
        $schema->string('location_id')
            ->description('The code of the location to filter materials by.')
            ->required();
        $schema->string('supplier_id')
            ->description('The code of the supplier to filter materials by.')
            ->required();
        $schema->string('search')
            ->description('Optional item code to match materials against.');

        return $schema;
    }

    /**
     * Execute the tool call.
     *
     * @return ToolResult|Generator
     */
    public function handle(array $arguments): ToolResult|Generator
    {
        $supplierId = $arguments['supplier_id'];
        $locationId = $arguments['location_id'];
        $search = $arguments['search'] ?? null;
        $query = MaterialItem::query()
            ->select('material_items.id', 'material_items.code', 'material_items.description');
        if ($supplierId) {
            $query->where('supplier_id', $supplierId);
        }
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }
        $materialItems = $query->limit(100)->get();
        $itemCodes = [];
        foreach ($materialItems as $item) {
            $priceData = $this->getPrice($item->id, $locationId);
            $itemCodes[] = $priceData->getData();
        }

        return ToolResult::text(json_encode($itemCodes, JSON_PRETTY_PRINT));
    }

    private function getPrice($materilItemId, $locationId)
    {
        $item = MaterialItem::with('costCode')->find($materilItemId);
        // Fetch the location-specific price (filtered in SQL)
        $location_price = DB::table('location_item_pricing')
            ->where('material_item_id', $materilItemId)
            ->where('location_id', $locationId)
            ->join('locations', 'location_item_pricing.location_id', '=', 'locations.id')
            ->select('locations.name as location_name', 'locations.id as location_id', 'location_item_pricing.unit_cost_override')
            ->first();

        if ($location_price) {
            $item->unit_cost = $location_price->unit_cost_override;
        }

        // Convert to array for response
        $itemArray = $item->toArray();
        $itemArray['price_list'] = $location_price ? $location_price->location_name : 'base_price';
        $itemArray['cost_code'] = $item->costCode ? $item->costCode->code : null;

        return response()->json($itemArray);
    }
}

