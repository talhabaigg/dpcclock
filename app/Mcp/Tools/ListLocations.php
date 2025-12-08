<?php

namespace App\Mcp\Tools;

use Generator;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\Title;
use Laravel\Mcp\Server\Tools\ToolInputSchema;
use Laravel\Mcp\Server\Tools\ToolResult;

#[Title('List Locations')]
class ListLocations extends Tool
{
    /**
     * A description of the tool.
     */
    public function description(): string
    {
        return <<<'DESC'
Use this tool to list all locations.

It returns:
- Basic info: id, name, and other relevant details for each location
DESC;
    }

    /**
     * The input schema of the tool.
     */
    public function schema(ToolInputSchema $schema): ToolInputSchema
    {
        $schema->string('search')
            ->description('A name or code to filter locations by.')
            ->required();

        return $schema;
    }

    /**
     * Execute the tool call.
     *
     * @return ToolResult|Generator
     */
    public function handle(array $arguments): ToolResult|Generator
    {
        $search = $arguments['search'] ?? null;
        $query = \App\Models\Location::query();

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('external_id', 'like', "%{$search}%");
            });
        }

        $payload = $query->limit(10)->get();

        return ToolResult::text($payload->toJson());
    }
}
