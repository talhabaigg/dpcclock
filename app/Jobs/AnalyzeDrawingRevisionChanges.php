<?php

namespace App\Jobs;

use App\Models\DrawingComparison;
use App\Services\Drawings\DrawingComparisonService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Runs revision change detection for one comparison off the request cycle.
 *
 * Unique per comparison: two users opening the same revision pair at once must
 * not both pay for the model call.
 */
class AnalyzeDrawingRevisionChanges implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $backoff = 30;

    /**
     * The vision pass reads regions one at a time, so a heavily revised sheet
     * legitimately runs for several minutes — an observed 13-region sheet took
     * ~3.5. Timing out mid-run wastes every model call already paid for.
     */
    public int $timeout = 1800;

    /**
     * Lock lifetime. Comfortably longer than the job timeout so a hard kill
     * cannot leave the pair locked indefinitely.
     */
    public int $uniqueFor = 2400;

    public function __construct(public int $comparisonId)
    {
        $this->onQueue(config('drawings.comparison.queue', 'default'));
    }

    public function uniqueId(): string
    {
        return 'drawing-comparison-'.$this->comparisonId;
    }

    public function handle(DrawingComparisonService $service): void
    {
        $comparison = DrawingComparison::find($this->comparisonId);

        if (! $comparison) {
            return;
        }

        $service->analyze($comparison);
    }

    public function failed(\Throwable $e): void
    {
        Log::error('AnalyzeDrawingRevisionChanges failed', [
            'comparison_id' => $this->comparisonId,
            'error' => $e->getMessage(),
        ]);

        DrawingComparison::where('id', $this->comparisonId)
            ->whereIn('status', [DrawingComparison::STATUS_PENDING, DrawingComparison::STATUS_RUNNING])
            ->update([
                'status' => DrawingComparison::STATUS_FAILED,
                'error' => $e->getMessage(),
            ]);
    }
}
