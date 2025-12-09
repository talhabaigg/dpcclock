<?php

namespace App\Mcp\Servers;

use App\Mcp\Resources\RequisitionsResource;
use App\Mcp\Tools\ListLocations;
use App\Mcp\Tools\ListMaterial;
use App\Mcp\Tools\ListSuppliers;
use App\Mcp\Tools\ReadRequisition;
use Laravel\Mcp\Server;

class RequisitionServer extends Server
{
    public string $serverName = 'Requisition Server';

    public string $serverVersion = '1.0.0';

    public string $instructions = 'This server allows to read requisitions and provide assistance.';

    public array $tools = [
        ReadRequisition::class,
        ListLocations::class,
        ListSuppliers::class,
        ListMaterial::class,
    ];

    public array $resources = [
        // RequisitionsResource::class,
    ];

    public array $prompts = [
        // ExamplePrompt::class,
    ];
}
