<?php

namespace App\Mcp\Servers;

use App\Mcp\Resources\RequisitionsResource;
use App\Mcp\Tools\ReadRequisitionTool;
use Laravel\Mcp\Server;

class RequisitionServer extends Server
{
    public string $serverName = 'Requisition Server';

    public string $serverVersion = '1.0.0';

    public string $instructions = 'This server allows to read requisitions and provide assistance.';

    public array $tools = [
        ReadRequisitionTool::class,
    ];

    public array $resources = [
        // RequisitionsResource::class,
    ];

    public array $prompts = [
        // ExamplePrompt::class,
    ];
}
