<?php

namespace App\Mcp\Resources;

use App\Models\Requisition;
use Laravel\Mcp\Server\Resource;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
class RequisitionsResource extends Resource
{
    protected string $name = 'requisition';
    protected string $title = 'Requisition Resource';
    protected string $description = 'Resource for requisitions data.';

    // Important: your content is JSON, not plain text
    protected string $mimeType = 'application/json';

    public function handle(Request $request): Response
    {
        $requisitions = Requisition::with('lineItems', 'creator', 'location', 'supplier')->get();

        return Response::text($requisitions->toJson());
    }
}

