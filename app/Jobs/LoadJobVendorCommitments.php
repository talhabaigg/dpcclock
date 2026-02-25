<?php

namespace App\Jobs;

use App\Models\JobVendorCommitment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class LoadJobVendorCommitments implements ShouldQueue
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
        Log::info('LoadJobVendorCommitments: Job started');

        try {
            $url = config('premier.api.base_url').config('premier.endpoints.job_vendor_commitments');

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

            if (! $response->successful()) {
                throw new \RuntimeException(
                    "API request failed with status {$response->status()}: {$response->body()}"
                );
            }

            $json = $response->json();

            // Validate response structure
            if (! isset($json['d'])) {
                throw new \RuntimeException('Invalid API response structure: missing "d" property');
            }

            // OData v2: rows are usually in d.results, but can also be d.{0,1,2...}
            $rows = $json['d']['results'] ?? array_values($json['d'] ?? []);

            if (! is_array($rows)) {
                throw new \RuntimeException('Invalid API response: expected array of rows');
            }

            if (count($rows) === 0) {
                Log::warning('LoadJobVendorCommitments: ERP returned 0 rows, skipping database update');

                return;
            }

            // Log the first row keys to help verify field mapping
            Log::info('LoadJobVendorCommitments: Sample row keys', [
                'keys' => array_keys($rows[0] ?? []),
            ]);

            Log::info('LoadJobVendorCommitments: Processing records', ['count' => count($rows)]);

            $data = [];
            foreach ($rows as $r) {
                $data[] = [
                    'job_number' => $r['Job_Number'] ?? null,
                    'company' => $r['Company'] ?? null,
                    'vendor' => $r['Vendor'] ?? null,
                    'subcontract_no' => $r['Subcontract_No'] ?? null,
                    'po_no' => $r['PO_No'] ?? null,
                    'approval_status' => $r['Approval_Status'] ?? null,
                    'project_manager' => $r['Project_Manager'] ?? null,
                    'original_commitment' => isset($r['Original_Commitment']) ? (float) $r['Original_Commitment'] : null,
                    'approved_changes' => isset($r['Approved_Changes']) ? (float) $r['Approved_Changes'] : null,
                    'current_commitment' => isset($r['Current_Commitment']) ? (float) $r['Current_Commitment'] : null,
                    'total_billed' => isset($r['Total_Billed']) ? (float) $r['Total_Billed'] : null,
                    'os_commitment' => isset($r['OS_Commitment']) ? (float) $r['OS_Commitment'] : null,
                    'invoiced_amount' => isset($r['Invoiced_Amount']) ? (float) $r['Invoiced_Amount'] : null,
                    'retainage_percent' => isset($r['Retainage__']) ? (float) $r['Retainage__'] : null,
                    'retainage' => isset($r['Retainage']) ? (float) $r['Retainage'] : null,
                    'paid_amount' => isset($r['Paid_Amount']) ? (float) $r['Paid_Amount'] : null,
                    'ap_balance' => isset($r['AP_Balance']) ? (float) $r['AP_Balance'] : null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            $conn = JobVendorCommitment::query()->getConnection();
            $batchSize = config('premier.jobs.batch_size', 1000);

            $conn->transaction(function () use ($data, $batchSize) {
                // Delete all records (don't use truncate inside transaction as it auto-commits)
                JobVendorCommitment::query()->delete();

                $chunks = array_chunk($data, $batchSize);
                foreach ($chunks as $index => $chunk) {
                    $chunkNumber = $index + 1;
                    Log::info("LoadJobVendorCommitments: Inserting chunk {$chunkNumber}", [
                        'rows' => count($chunk),
                        'total_chunks' => count($chunks),
                    ]);

                    JobVendorCommitment::insert($chunk);
                }
            });

            $duration = now()->diffInSeconds($startTime);
            Log::info('LoadJobVendorCommitments: Job completed successfully', [
                'records_processed' => count($data),
                'duration_seconds' => $duration,
            ]);

        } catch (Throwable $e) {
            Log::error('LoadJobVendorCommitments: Job failed', [
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
        Log::error('LoadJobVendorCommitments: Job failed permanently after all retries', [
            'error' => $exception->getMessage(),
            'attempts' => $this->attempts(),
        ]);
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
