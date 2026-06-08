<?php

namespace App\Logging;

use Illuminate\Log\Logger;

/**
 * Logging "tap" that adds a BroadcastLogHandler alongside the channel's existing handlers.
 * Wire onto a channel via `'tap' => [App\Logging\AddBroadcastHandler::class]` in
 * config/logging.php.
 */
class AddBroadcastHandler
{
    public function __invoke(Logger $logger): void
    {
        $logger->pushHandler(new BroadcastLogHandler);
    }
}
