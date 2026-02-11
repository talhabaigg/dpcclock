<?php

namespace App\Jobs;

use App\Models\Drawing;
use App\Services\DrawingProcessingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessDrawingJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public int $timeout = 300; // 5 minutes

    protected int $drawingId;

    protected bool $generateDiff;

    /**
     * Create a new job instance.
     */
    public function __construct(int $drawingId, bool $generateDiff = true)
    {
        $this->drawingId = $drawingId;
        $this->generateDiff = $generateDiff;
    }

    /**
     * Execute the job.
     */
    public function handle(DrawingProcessingService $processingService): void
    {
        $drawing = Drawing::find($this->drawingId);

        if (! $drawing) {
            Log::warning('ProcessDrawingJob: Drawing not found', ['id' => $this->drawingId]);

            return;
        }

        Log::info('ProcessDrawingJob: Starting processing', [
            'drawing_id' => $drawing->id,
            'name' => $drawing->name,
        ]);

        // Step 1: Process drawing (thumbnail, dimensions, diff)
        $results = $processingService->processDrawing($drawing);

        Log::info('ProcessDrawingJob: Image processing complete', [
            'drawing_id' => $drawing->id,
            'results' => $results,
        ]);

        // Step 2: Generate tiles for high-res viewing
        GenerateDrawingTilesJob::dispatch($drawing->id);
        Log::info('ProcessDrawingJob: Tile generation job dispatched', [
            'drawing_id' => $drawing->id,
        ]);

        Log::info('ProcessDrawingJob: All processing complete', [
            'drawing_id' => $drawing->id,
            'results' => $results,
        ]);
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('ProcessDrawingJob: Failed', [
            'drawing_id' => $this->drawingId,
            'error' => $exception->getMessage(),
        ]);

        // Update drawing status to indicate failure
        $drawing = Drawing::find($this->drawingId);
        if ($drawing) {
            $drawing->update(['status' => Drawing::STATUS_DRAFT]);
        }
    }
}
