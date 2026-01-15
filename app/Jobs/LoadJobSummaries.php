<?php

namespace App\Jobs;

use App\Models\JobCostDetail;
use App\Models\JobSummary;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class LoadJobSummaries implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     *
     * @var int
     */
    public $tries;

    /**
     * The number of seconds the job can run before timing out.
     *
     * @var int
     */
    public $timeout;

    /**
     * Create a new job instance.
     */
    public function __construct()
    {
        $this->tries = config('premier.jobs.retry_times', 3);
        $this->timeout = config('premier.jobs.timeout', 600);
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $startTime = now();
        Log::info('LoadJobSummaries: Job started');

        try {
            $url = config('premier.api.base_url') . config('premier.endpoints.job_summaries');

            $response = Http::timeout(config('premier.api.timeout', 300))
                ->withBasicAuth(
                    config('premier.api.username'),
                    config('premier.api.password')
                )
                ->withHeaders([
                    'Accept' => 'application/json',
                    'DataServiceVersion' => '2.0',
                    'MaxDataServiceVersion' => '2.0',
                ])
                ->get($url);

            if (!$response->successful()) {
                throw new \RuntimeException(
                    "API request failed with status {$response->status()}: {$response->body()}"
                );
            }

            $json = $response->json();

            // Validate response structure
            if (!isset($json['d'])) {
                throw new \RuntimeException('Invalid API response structure: missing "d" property');
            }

            // OData v2: rows are usually in d.results, but can also be d.{0,1,2...}
            $rows = $json['d']['results'] ?? array_values($json['d'] ?? []);

            if (!is_array($rows)) {
                throw new \RuntimeException('Invalid API response: expected array of rows');
            }

            if (count($rows) === 0) {
                Log::warning('LoadJobSummaries: ERP returned 0 rows, skipping database update');
                return;
            }

            Log::info('LoadJobSummaries: Processing records', ['count' => count($rows)]);
            // Process data in chunks to avoid memory issues
            $data = [];
            foreach ($rows as $r) {
                // Helper to extract ms from OData date string
                $extractMs = function ($dateStr) {
                    if (!empty($dateStr) && preg_match('/\/Date\((\d+)\)\//', $dateStr, $m)) {
                        return (int) $m[1];
                    }
                    return null;
                };

                $startMs = $extractMs($r['Start_Date'] ?? null);
                $estimatedEndMs = $extractMs($r['Estimated_End_Date'] ?? null);
                $actualEndMs = $extractMs($r['Actual_End_Date'] ?? null);

                $data[] = [
                    'job_number' => $r['Job_Number'] ?? null,
                    'company_code' => $r['Company_Code'] ?? null,
                    'start_date' => $startMs ? Carbon::createFromTimestampMs($startMs) : null,
                    'estimated_end_date' => $estimatedEndMs ? Carbon::createFromTimestampMs($estimatedEndMs) : null,
                    'actual_end_date' => $actualEndMs ? Carbon::createFromTimestampMs($actualEndMs) : null,
                    'status' => $r['Status'] ?? null,
                    'original_estimate_cost' => isset($r['Original_Estimate_Cost']) ? (float) $r['Original_Estimate_Cost'] : null,
                    'current_estimate_cost' => isset($r['Current_Estimate_Cost']) ? (float) $r['Current_Estimate_Cost'] : null,
                    'original_estimate_revenue' => isset($r['Original_Estimate_Revenue']) ? (float) $r['Original_Estimate_Revenue'] : null,
                    'current_estimate_revenue' => isset($r['Current_Estimate_Revenue']) ? (float) $r['Current_Estimate_Revenue'] : null,
                    'over_under_billing' => isset($r['Over_Under_Billing']) ? (float) $r['Over_Under_Billing'] : null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            $conn = JobSummary::query()->getConnection();
            $batchSize = config('premier.jobs.batch_size', 1000);

            $conn->transaction(function () use ($data, $batchSize) {
                // Delete all records (don't use truncate inside transaction as it auto-commits)
                JobSummary::query()->delete();

                $chunks = array_chunk($data, $batchSize);
                foreach ($chunks as $index => $chunk) {
                    $chunkNumber = $index + 1;
                    Log::info("LoadJobSummaries: Inserting chunk {$chunkNumber}", [
                        'rows' => count($chunk),
                        'total_chunks' => count($chunks)
                    ]);

                    JobSummary::insert($chunk);
                }
            });

            $duration = now()->diffInSeconds($startTime);
            Log::info('LoadJobSummaries: Job completed successfully', [
                'records_processed' => count($data),
                'duration_seconds' => $duration
            ]);

        } catch (Throwable $e) {
            Log::error('LoadJobSummaries: Job failed', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(Throwable $exception): void
    {
        Log::error('LoadJobSummaries: Job failed permanently after all retries', [
            'error' => $exception->getMessage(),
            'attempts' => $this->attempts()
        ]);

        // Here you could send notifications to administrators
        // Example: notify(new JobFailedNotification($exception));
    }

    /**
     * Calculate the number of seconds to wait before retrying the job.
     */
    public function backoff(): array
    {
        // Exponential backoff: 1 minute, 2 minutes, 4 minutes
        return [60, 120, 240];
    }
}
