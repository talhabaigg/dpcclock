<?php

namespace App\Ai\Tools;

use App\Models\MaterialItem;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class SearchMaterials implements Tool
{
    public function description(): Stringable|string
    {
        return 'Search for material items available for ordering. Returns items with pricing (location-specific if available, otherwise base price). Always provide location_id for accurate pricing.';
    }

    public function handle(Request $request): Stringable|string
    {
        $locationId = $request['location_id'] ?? null;
        $supplierId = $request['supplier_id'] ?? null;
        $search = $request['search'] ?? null;

        $buildQuery = function (bool $withSupplier) use ($supplierId, $search) {
            $query = MaterialItem::query()->with(['costCode', 'supplier:id,name,code']);

            if ($withSupplier && $supplierId) {
                $query->where('supplier_id', $supplierId);
            }

            if ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('code', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            }

            return $query->orderBy('description');
        };

        $baseQuery = $buildQuery(true);
        $totalCount = $baseQuery->count();
        $materials = $baseQuery->limit(50)->get();
        $crossSupplier = false;

        // If no results with supplier filter, retry without it
        if ($materials->isEmpty() && $supplierId && $search) {
            $fallbackQuery = $buildQuery(false);
            $totalCount = $fallbackQuery->count();
            $materials = $fallbackQuery->limit(50)->get();
            $crossSupplier = $materials->isNotEmpty();
        }

        // Get location-specific pricing if location_id provided
        $locationPrices = [];
        if ($locationId) {
            $locationPrices = DB::table('location_item_pricing')
                ->where('location_id', $locationId)
                ->whereIn('material_item_id', $materials->pluck('id'))
                ->pluck('unit_cost_override', 'material_item_id')
                ->toArray();
        }

        $results = $materials->map(function ($item) use ($locationPrices, $crossSupplier) {
            $hasLocationPrice = isset($locationPrices[$item->id]);
            $unitCost = $hasLocationPrice ? $locationPrices[$item->id] : $item->unit_cost;

            $result = [
                'id' => $item->id,
                'code' => $item->code,
                'description' => $item->description,
                'unit_cost' => (float) $unitCost,
                'price_source' => $hasLocationPrice ? 'location_price' : 'base_price',
                'cost_code' => $item->costCode?->code,
            ];

            if ($crossSupplier && $item->supplier) {
                $result['supplier'] = $item->supplier->name;
                $result['supplier_id'] = $item->supplier->id;
            }

            return $result;
        })->all();

        $basePriceCount = collect($results)->where('price_source', 'base_price')->count();

        $response = [
            'materials' => $results,
            'count' => count($results),
            'total_available' => $totalCount,
        ];

        if (count($results) < $totalCount) {
            $response['note'] = "Showing {$response['count']} of {$totalCount} items. Use a search term (code or description) to find specific materials.";
        }

        if ($crossSupplier) {
            $response['note'] = 'No results found for the selected supplier. These materials are from other suppliers — confirm with the user if they want to use a different supplier or add these items anyway.';
        }

        if ($locationId && $basePriceCount > 0) {
            $response['warning'] = "{$basePriceCount} item(s) have no location-specific price — using base price. Verify with the user that these prices are correct.";
        }

        return json_encode($response, JSON_PRETTY_PRINT);
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'location_id' => $schema->integer()->description('Location ID for location-specific pricing. Required for accurate prices.')->required(),
            'supplier_id' => $schema->integer()->description('Filter materials by supplier ID')->required(),
            'search' => $schema->string()->description('Search term to filter by code or description'),
        ];
    }
}
