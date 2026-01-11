<?php

namespace App\Jobs;

use App\Models\ArProgressBillingSummary;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class LoadArProgressBillingSummaries implements ShouldQueue
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
        Log::info('LoadArProgressBillingSummaries: Job started');

        try {
            $url = config('premier.api.base_url') . config('premier.endpoints.ar_progress_billing');

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
                Log::warning('LoadArProgressBillingSummaries: ERP returned 0 rows, skipping database update');
                return;
            }

            Log::info('LoadArProgressBillingSummaries: Processing records', ['count' => count($rows)]);

            // Process data
            $data = [];
            foreach ($rows as $r) {
                $fromMs = null;
                $periodMs = null;

                if (!empty($r['From_Date']) && preg_match('/\/Date\((\d+)\)\//', $r['From_Date'], $m)) {
                    $fromMs = (int) $m[1];
                }

                if (!empty($r['Period_End_Date']) && preg_match('/\/Date\((\d+)\)\//', $r['Period_End_Date'], $m)) {
                    $periodMs = (int) $m[1];
                }

                $data[] = [
                    'job_number' => $r['Job_Number'] ?? null,
                    'application_number' => $r['Application_Number'] ?? null,
                    'description' => $r['Description'] ?? null,
                    'from_date' => $fromMs ? Carbon::createFromTimestampMsUTC($fromMs)->toDateString() : null,
                    'period_end_date' => $periodMs ? Carbon::createFromTimestampMsUTC($periodMs)->toDateString() : null,
                    'status_name' => $r['Status_Name'] ?? null,
                    'this_app_work_completed' => isset($r['This_App_Work_Completed']) ? (float) $r['This_App_Work_Completed'] : null,
                    'contract_sum_to_date' => isset($r['Contract_Sum_To_Date']) ? (float) $r['Contract_Sum_To_Date'] : null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            $conn = ArProgressBillingSummary::query()->getConnection();
            $batchSize = config('premier.jobs.batch_size', 1000);

            $conn->transaction(function () use ($data, $batchSize) {
                // Use truncate for better performance
                ArProgressBillingSummary::query()->truncate();

                $chunks = array_chunk($data, $batchSize);
                foreach ($chunks as $index => $chunk) {
                    $chunkNumber = $index + 1;
                    Log::info("LoadArProgressBillingSummaries: Inserting chunk {$chunkNumber}", [
                        'rows' => count($chunk),
                        'total_chunks' => count($chunks)
                    ]);

                    ArProgressBillingSummary::insert($chunk);
                }
            });

            $duration = now()->diffInSeconds($startTime);
            Log::info('LoadArProgressBillingSummaries: Job completed successfully', [
                'records_processed' => count($data),
                'duration_seconds' => $duration
            ]);

        } catch (Throwable $e) {
            Log::error('LoadArProgressBillingSummaries: Job failed', [
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
        Log::error('LoadArProgressBillingSummaries: Job failed permanently after all retries', [
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
