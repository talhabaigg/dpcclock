<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Fired (and broadcast synchronously) whenever a new line is written to a tapped log channel.
 * Streams to the queue-status page log viewer so admins see new entries the moment they hit disk.
 *
 * Uses ShouldBroadcastNow rather than the queued variant to avoid spawning a job for every
 * single log entry — that would itself log on completion and create a feedback loop.
 */
class LogLineAppended implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public string $line,
        public string $level,
        public string $channel,
        public string $timestamp,
    ) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('portal-logs');
    }

    public function broadcastAs(): string
    {
        return 'log.line.appended';
    }

    public function broadcastWith(): array
    {
        return [
            'line' => $this->line,
            'level' => $this->level,
            'channel' => $this->channel,
            'timestamp' => $this->timestamp,
        ];
    }
}
