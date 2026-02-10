<?php

namespace App\Jobs;

use App\Models\Drawing;
use App\Services\DrawingTileService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class GenerateDrawingTilesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $backoff = 120;
    public int $timeout = 600; // 10 minutes for large drawings

    protected int $drawingId;
    protected bool $force;

    /**
     * Create a new job instance.
     *
     * @param int $drawingId The ID of the drawing to generate tiles for
     * @param bool $force If true, regenerate tiles even if they already exist
     */
    public function __construct(int $drawingId, bool $force = false)
    {
        $this->drawingId = $drawingId;
        $this->force = $force;
    }

    /**
     * Execute the job.
     */
    public function handle(DrawingTileService $tileService): void
    {
        $drawing = Drawing::find($this->drawingId);

        if (!$drawing) {
            Log::warning('GenerateDrawingTilesJob: Drawing not found', ['id' => $this->drawingId]);
            return;
        }

        // Skip if tiles already exist and force is false
        if (!$this->force && $tileService->hasTiles($drawing)) {
            Log::info('GenerateDrawingTilesJob: Tiles already exist, skipping', [
                'drawing_id' => $drawing->id,
            ]);
            return;
        }

        // Delete existing tiles if forcing regeneration
        if ($this->force && $drawing->tiles_base_url) {
            Log::info('GenerateDrawingTilesJob: Force regeneration, deleting existing tiles', [
                'drawing_id' => $drawing->id,
            ]);
            $tileService->deleteTiles($drawing);
        }

        Log::info('GenerateDrawingTilesJob: Starting tile generation', [
            'drawing_id' => $drawing->id,
            'name' => $drawing->name,
        ]);

        $result = $tileService->generateTiles($drawing);

        if ($result['success']) {
            Log::info('GenerateDrawingTilesJob: Tile generation complete', [
                'drawing_id' => $drawing->id,
                'tiles_count' => $result['tiles_count'],
                'max_zoom' => $result['max_zoom'],
                'dimensions' => "{$result['width']}x{$result['height']}",
            ]);
        } else {
            Log::error('GenerateDrawingTilesJob: Tile generation failed', [
                'drawing_id' => $drawing->id,
                'error' => $result['error'],
            ]);
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('GenerateDrawingTilesJob: Failed', [
            'drawing_id' => $this->drawingId,
            'error' => $exception->getMessage(),
            'trace' => $exception->getTraceAsString(),
        ]);

        // Update drawing tile status to indicate failure
        $drawing = Drawing::find($this->drawingId);
        if ($drawing) {
            $drawing->update(['tiles_status' => 'failed']);
        }
    }

    /**
     * Determine the queue the job should be sent to.
     */
    public function queue(): string
    {
        return 'drawings';
    }
}
