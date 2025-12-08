<?php

namespace App\Mcp\Tools;

use Generator;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\Title;
use Laravel\Mcp\Server\Tools\ToolInputSchema;
use Laravel\Mcp\Server\Tools\ToolResult;

#[Title('List Suppliers')]
class ListSuppliers extends Tool
{
    /**
     * A description of the tool.
     */
    public function description(): string
    {
        return <<<'DESC'
Use this tool to list all locations.

It returns:
- Basic info: id, code, name, and other relevant details for each supplier
DESC;
    }
    /**
     * The input schema of the tool.
     */
    // public function schema(ToolInputSchema $schema): ToolInputSchema
    // {
    //     $schema->string('example')
    //         ->description('An example input description.')
    //         ->required();

    //     return $schema;
    // }

    /**
     * Execute the tool call.
     *
     * @return ToolResult|Generator
     */
    public function handle(array $arguments): ToolResult|Generator
    {
        $suppliers = \App\Models\Supplier::all();

        return ToolResult::text($suppliers->toJson());
    }
}
