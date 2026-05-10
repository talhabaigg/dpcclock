<?php

namespace App\Jobs;

use App\Http\Controllers\Traits\ProductionStatusTrait;
use App\Models\Drawing;
use App\Models\DrawingMeasurement;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

/**
 * Refresh BudgetHoursEntry rows for a project after a bulk production import.
 *
 * Splitting this off from the synchronous import path keeps the HTTP request
 * fast: the upsert into measurement_statuses commits inline, then this job
 * recomputes the per-(bid_area, lcc, work_date) budget aggregates in the
 * background. If the worker is down or the job fails, the production data is
 * still safe — only the derived budget percentages lag until it runs.
 */
class SyncProductionToBudgetJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels, ProductionStatusTrait;

    public int $tries = 2;

    public int $backoff = 60;

    public int $timeout = 900;

    /**
     * @param  array<int, string>  $workDates
     */
    public function __construct(
        public int $locationId,
        public array $workDates,
        public ?int $userId = null,
    ) {}

    public function handle(): void
    {
        if (empty($this->workDates)) {
            return;
        }

        // syncProductionToBudget uses auth()->id() for BudgetHoursEntry.updated_by.
        // Restore that identity in the queue context so the audit trail points to
        // the user who ran the import, not "system".
        if ($this->userId) {
            Auth::onceUsingId($this->userId);
        }

        $anyDrawing = Drawing::where('project_id', $this->locationId)->first();
        if (! $anyDrawing) {
            Log::info('SyncProductionToBudgetJob: no drawings in project, skipping', [
                'location_id' => $this->locationId,
            ]);

            return;
        }

        $projectDrawingIds = Drawing::where('project_id', $this->locationId)->pluck('id');
        $measurements = DrawingMeasurement::whereIn('drawing_id', $projectDrawingIds)
            ->with(['condition.conditionLabourCodes.labourCostCode'])
            ->get();

        Log::info('SyncProductionToBudgetJob: starting', [
            'location_id' => $this->locationId,
            'dates' => count($this->workDates),
            'measurements' => $measurements->count(),
        ]);

        foreach ($this->workDates as $date) {
            $this->syncProductionToBudget($anyDrawing, $date, $measurements);
        }

        Log::info('SyncProductionToBudgetJob: done', [
            'location_id' => $this->locationId,
            'dates' => count($this->workDates),
        ]);
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('SyncProductionToBudgetJob: failed', [
            'location_id' => $this->locationId,
            'dates' => count($this->workDates),
            'error' => $exception->getMessage(),
        ]);
    }
}
