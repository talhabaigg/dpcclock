<?php

namespace App\Jobs;

use App\Models\JobCostDetail;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class LoadJobCostDetails implements ShouldQueue
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
        Log::info('LoadJobCostDetails: Job started');

        try {
            $url = config('premier.api.base_url') . config('premier.endpoints.job_cost_details');

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
                Log::warning('LoadJobCostDetails: ERP returned 0 rows, skipping database update');
                return;
            }

            Log::info('LoadJobCostDetails: Processing records', ['count' => count($rows)]);

            // Process data in chunks to avoid memory issues
            $data = [];
            foreach ($rows as $r) {
                $ms = null;
                if (!empty($r['Transaction_Date']) && preg_match('/\/Date\((\d+)\)\//', $r['Transaction_Date'], $m)) {
                    $ms = (int) $m[1];
                }

                $data[] = [
                    'job_number' => $r['Job_Number'] ?? null,
                    'job_name' => $r['Job_Name'] ?? null,
                    'cost_item' => $r['Cost_Item'] ?? null,
                    'cost_type' => $r['Cost_Type'] ?? null,
                    'transaction_date' => $ms ? Carbon::createFromTimestampMsUTC($ms)->toDateString() : null,
                    'description' => $r['Description'] ?? null,
                    'transaction_type' => $r['Transaction_Type'] ?? null,
                    'ref_number' => $r['Ref_Number'] ?? null,
                    'amount' => isset($r['Amount']) ? (float) $r['Amount'] : null,
                    'company_code' => $r['Company_Code'] ?? null,
                    'cost_item_description' => $r['Cost_Item_Description'] ?? null,
                    'cost_type_description' => $r['Cost_Type_Description'] ?? null,
                    'project_manager' => $r['Project_Manager'] ?? null,
                    'quantity' => isset($r['Quantity']) ? (float) $r['Quantity'] : null,
                    'unit_cost' => isset($r['Unit_Cost_plus_Tax1']) ? (float) $r['Unit_Cost_plus_Tax1'] : null,
                    'vendor' => $r['Vendor'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            $conn = JobCostDetail::query()->getConnection();
            $batchSize = config('premier.jobs.batch_size', 1000);

            $conn->transaction(function () use ($data, $batchSize) {
                // Use truncate for better performance
                JobCostDetail::query()->truncate();

                $chunks = array_chunk($data, $batchSize);
                foreach ($chunks as $index => $chunk) {
                    $chunkNumber = $index + 1;
                    Log::info("LoadJobCostDetails: Inserting chunk {$chunkNumber}", [
                        'rows' => count($chunk),
                        'total_chunks' => count($chunks)
                    ]);

                    JobCostDetail::insert($chunk);
                }
            });

            $duration = now()->diffInSeconds($startTime);
            Log::info('LoadJobCostDetails: Job completed successfully', [
                'records_processed' => count($data),
                'duration_seconds' => $duration
            ]);

        } catch (Throwable $e) {
            Log::error('LoadJobCostDetails: Job failed', [
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
        Log::error('LoadJobCostDetails: Job failed permanently after all retries', [
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
