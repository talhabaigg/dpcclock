<?php

use Laravel\Mcp\Server\Facades\Mcp;

Mcp::web('requisitions', \App\Mcp\Servers\RequisitionServer::class); // Available at /mcp/requisitions
// Mcp::local('requisitions', \App\Mcp\Servers\RequisitionServer::class);
// Mcp::local('demo', \App\Mcp\Servers\LocalServer::class); // Start with ./artisan mcp:start demo
