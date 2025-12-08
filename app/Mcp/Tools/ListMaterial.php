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
        return 'Use this tool to list all materials filtered by location, supplier, matching item code or matching description.';
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

        return ToolResult::text($materialItems->toJson());
    }
}
