<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Broadcast event for drawing set processing updates.
 * Used to show real-time progress on the frontend.
 */
class DrawingSetProcessingUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public int $projectId;

    public int $drawingSetId;

    public string $status;

    public ?int $sheetId;

    public ?int $pageNumber;

    public ?string $extractionStatus;

    public ?string $drawingNumber;

    public ?string $drawingTitle;

    public ?string $revision;

    public array $stats;

    public ?string $thumbnailUrl;

    /**
     * Create a new event instance.
     */
    public function __construct(
        int $projectId,
        int $drawingSetId,
        string $status,
        ?int $sheetId = null,
        ?int $pageNumber = null,
        ?string $extractionStatus = null,
        ?string $drawingNumber = null,
        ?string $drawingTitle = null,
        ?string $revision = null,
        array $stats = [],
        ?string $thumbnailUrl = null
    ) {
        $this->projectId = $projectId;
        $this->drawingSetId = $drawingSetId;
        $this->status = $status;
        $this->sheetId = $sheetId;
        $this->pageNumber = $pageNumber;
        $this->extractionStatus = $extractionStatus;
        $this->drawingNumber = $drawingNumber;
        $this->drawingTitle = $drawingTitle;
        $this->revision = $revision;
        $this->stats = $stats;
        $this->thumbnailUrl = $thumbnailUrl;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): Channel
    {
        return new Channel('drawing-sets.'.$this->projectId);
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'processing.updated';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'project_id' => $this->projectId,
            'drawing_set_id' => $this->drawingSetId,
            'status' => $this->status,
            'sheet_id' => $this->sheetId,
            'page_number' => $this->pageNumber,
            'extraction_status' => $this->extractionStatus,
            'drawing_number' => $this->drawingNumber,
            'drawing_title' => $this->drawingTitle,
            'revision' => $this->revision,
            'stats' => $this->stats,
            'thumbnail_url' => $this->thumbnailUrl,
            'timestamp' => now()->toISOString(),
        ];
    }
}
