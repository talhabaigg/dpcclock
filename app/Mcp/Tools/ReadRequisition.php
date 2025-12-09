<?php

namespace App\Mcp\Tools;

use App\Models\Requisition;
use Generator;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\Title;
use Laravel\Mcp\Server\Tools\ToolInputSchema;
use Laravel\Mcp\Server\Tools\ToolResult;

#[Title('Read Requisition')]
class ReadRequisition extends Tool
{
    /**
     * A description of the tool.
     *
     * This is what the LLM sees – make it clear when it should use this.
     */
    public function description(): string
    {
        return <<<'DESC'
Use this tool to look up a single requisition by ID and get a detailed summary.

It returns:
- Basic info: id, number/code, status, created_at, requested_by, location, supplier
- Financials: subtotal, tax, total, currency
- Line items: code/description/qty/unit_cost/line_total/cost_code/price_list
DESC;
    }

    /**
     * The input schema of the tool.
     */
    public function schema(ToolInputSchema $schema): ToolInputSchema
    {
        $schema
            ->integer('requisition_id')
            ->description('The numeric ID of the requisition to read.')
            ->required();

        return $schema;
    }

    /**
     * Execute the tool call.
     *
     * @param  array<string, mixed>  $arguments
     * @return ToolResult|Generator
     */
    public function handle(array $arguments): ToolResult|Generator
    {
        $requisitionId = (int) $arguments['requisition_id'];

        // Adjust relations as per your actual model names
        $requisition = Requisition::query()
            ->with([
                'creator',     // e.g. belongsTo(User::class, 'requested_by')
                'location',      // e.g. belongsTo(Location::class)
                'supplier',      // e.g. belongsTo(Supplier::class)
                'lineItems',         // e.g. hasMany(RequisitionLine::class)
            ])
            ->find($requisitionId);

        if (!$requisition) {
            return ToolResult::text(
                "No requisition was found with id {$requisitionId}."
            );
        }

        // Build a structured payload for the model to reason about
        $payload = [
            'id' => $requisition->id,
            'number' => $requisition->number ?? $requisition->code ?? null,
            'status' => $requisition->status ?? null,
            'created_at' => optional($requisition->created_at)->toIso8601String(),
            'requested_by' => optional($requisition->requester)->only(['id', 'name', 'email']),
            'location' => $requisition->location
                ? [
                    'id' => $requisition->location->id,
                    'name' => $requisition->location->name,
                    'code' => $requisition->location->external_id ?? null,
                ]
                : null,
            'supplier' => $requisition->supplier
                ? [
                    'id' => $requisition->supplier->id,
                    'name' => $requisition->supplier->name,
                    'code' => $requisition->supplier->code ?? null,
                ]
                : null,

            // tweak these fields to match your schema
            'currency' => $requisition->currency ?? 'AUD',
            'subtotal' => (float) ($requisition->subtotal ?? 0),
            'tax' => (float) ($requisition->tax_total ?? 0),
            'total' => (float) ($requisition->total ?? 0),

            'lines' => $requisition->lineItems
                ? $requisition->lineItems->map(function ($line) {
                    return [
                        'id' => $line->id,
                        'code' => $line->code ?? $line->item_code ?? null,
                        'description' => $line->description ?? null,
                        'qty' => (float) ($line->quantity ?? 0),
                        'unit' => $line->unit ?? null,
                        'unit_cost' => (float) ($line->unit_cost ?? 0),
                        'line_total' => (float) (
                            $line->line_total
                            ?? (($line->quantity ?? 0) * ($line->unit_cost ?? 0))
                        ),
                        'cost_code' => $line->cost_code ?? null,
                        'job' => $line->job_number ?? null,
                    ];
                })->values()->all()
                : [],
        ];

        // If your ToolResult has a json()/data() helper, you can use that.
        // To be safe and generic, we just JSON-encode into text.
        return ToolResult::text(json_encode($payload, JSON_PRETTY_PRINT));
    }
}
