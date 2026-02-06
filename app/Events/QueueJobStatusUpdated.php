<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class QueueJobStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public string $jobId;

    public string $jobName;

    public string $status;

    public ?string $message;

    public ?array $metadata;

    /**
     * Create a new event instance.
     */
    public function __construct(
        string $jobId,
        string $jobName,
        string $status,
        ?string $message = null,
        ?array $metadata = null
    ) {
        $this->jobId = $jobId;
        $this->jobName = $jobName;
        $this->status = $status;
        $this->message = $message;
        $this->metadata = $metadata;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): Channel
    {
        return new Channel('queue-status');
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'job.status.updated';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'job_id' => $this->jobId,
            'job_name' => $this->jobName,
            'status' => $this->status,
            'message' => $this->message,
            'metadata' => $this->metadata,
            'timestamp' => now()->toISOString(),
        ];
    }
}
