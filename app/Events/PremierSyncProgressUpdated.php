<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class PremierSyncProgressUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public int $cached;
    public int $total;
    public int $missing;
    public int $stale;
    public float $readyPercent;
    public ?string $lastSyncedPo;
    public string $status; // 'syncing', 'completed', 'error'

    public function __construct(
        int $cached,
        int $total,
        int $missing = 0,
        int $stale = 0,
        ?string $lastSyncedPo = null,
        string $status = 'syncing'
    ) {
        $this->cached = $cached;
        $this->total = $total;
        $this->missing = $missing;
        $this->stale = $stale;
        $this->readyPercent = $total > 0 ? round(($cached / $total) * 100, 1) : 100;
        $this->lastSyncedPo = $lastSyncedPo;
        $this->status = $status;
    }

    public function broadcastOn(): Channel
    {
        return new Channel('premier-sync');
    }

    public function broadcastAs(): string
    {
        return 'sync.progress';
    }

    public function broadcastWith(): array
    {
        return [
            'cached' => $this->cached,
            'total' => $this->total,
            'missing' => $this->missing,
            'stale' => $this->stale,
            'needs_sync' => $this->missing + $this->stale,
            'ready_percent' => $this->readyPercent,
            'last_synced_po' => $this->lastSyncedPo,
            'status' => $this->status,
            'timestamp' => now()->toISOString(),
        ];
    }
}
