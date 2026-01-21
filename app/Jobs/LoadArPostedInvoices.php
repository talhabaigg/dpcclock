<?php

namespace App\Jobs;

use App\Models\ArPostedInvoice;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class LoadArPostedInvoices implements ShouldQueue
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
        Log::info('LoadArPostedInvoices: Job started');

        try {
            $baseUrl = config('premier.api.base_url') . config('premier.endpoints.ar_posted_invoices');
            $insertBatchSize = 100;
            $pageSize = 200;
            $skip = 0;
            $totalProcessed = 0;
            $isFirstBatch = true;

            do {
                $url = $baseUrl . '?$top=' . $pageSize . '&$skip=' . $skip;

                Log::info("LoadArPostedInvoices: Fetching page", [
                    'skip' => $skip,
                    'top' => $pageSize
                ]);

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
                unset($response);

                if (!isset($json['d'])) {
                    throw new \RuntimeException('Invalid API response structure: missing "d" property');
                }

                $rows = $json['d']['results'] ?? array_values($json['d'] ?? []);
                unset($json);

                if (!is_array($rows)) {
                    throw new \RuntimeException('Invalid API response: expected array of rows');
                }

                $rowCount = count($rows);

                if ($rowCount === 0 && $isFirstBatch) {
                    Log::warning('LoadArPostedInvoices: ERP returned 0 rows, skipping database update');
                    return;
                }

                if ($rowCount === 0) {
                    break;
                }

                Log::info('LoadArPostedInvoices: Processing page', [
                    'rows' => $rowCount,
                    'skip' => $skip
                ]);

                if ($isFirstBatch) {
                    ArPostedInvoice::query()->delete();
                    $isFirstBatch = false;
                }

                $chunks = array_chunk($rows, $insertBatchSize);
                unset($rows);

                foreach ($chunks as $chunk) {
                    $data = [];
                    foreach ($chunk as $r) {
                        $data[] = $this->mapRowToRecord($r);
                    }
                    ArPostedInvoice::insert($data);
                    unset($data);
                }
                unset($chunks);

                $totalProcessed += $rowCount;
                $skip += $pageSize;

                gc_collect_cycles();

            } while ($rowCount === $pageSize);

            $duration = now()->diffInSeconds($startTime);
            Log::info('LoadArPostedInvoices: Job completed successfully', [
                'records_processed' => $totalProcessed,
                'duration_seconds' => $duration
            ]);

        } catch (Throwable $e) {
            Log::error('LoadArPostedInvoices: Job failed', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            throw $e;
        }
    }

    /**
     * Map an API row to a database record.
     */
    private function mapRowToRecord(array $r): array
    {
        return [
            'client_id' => $r['ClientId'] ?? null,
            'company' => $r['Company'] ?? null,
            'contract_customer_code' => $r['Contract_Customer_Code'] ?? null,
            'contract_customer_name' => $r['Contract_Customer_Name'] ?? null,
            'mail_to_customer_code' => $r['Mail_To_Customer_Code'] ?? null,
            'mail_to_customer_name' => $r['Mail_To_Customer_Name'] ?? null,
            'bill_to_customer_code' => $r['Bill_To_Customer_Code'] ?? null,
            'bill_to_customer_name' => $r['Bill_To_Customer_Name'] ?? null,
            'job_number' => $r['Job_Number'] ?? null,
            'job_name' => $r['Job_Name'] ?? null,
            'invoice_number' => $r['Invoice_Number'] ?? null,
            'invoice_date' => $this->parseODataDate($r['Invoice_Date'] ?? null),
            'due_date' => $this->parseODataDate($r['Due_Date'] ?? null),
            'transaction_date' => $this->parseODataDate($r['Transaction_Date'] ?? null),
            'subtotal' => isset($r['Subtotal']) ? (float) $r['Subtotal'] : null,
            'tax1' => isset($r['Tax1']) ? (float) $r['Tax1'] : null,
            'tax2' => isset($r['Tax2']) ? (float) $r['Tax2'] : null,
            'freight' => isset($r['Freight']) ? (float) $r['Freight'] : null,
            'discount' => isset($r['Discount']) ? (float) $r['Discount'] : null,
            'retainage' => isset($r['Retainage']) ? (float) $r['Retainage'] : null,
            'total' => isset($r['Total']) ? (float) $r['Total'] : null,
            'sales_category' => $r['Sales_Category'] ?? null,
            'memo' => $r['Memo'] ?? null,
            'invoice_status' => $r['Invoice_Status'] ?? null,
            'key' => $r['Key'] ?? null,
            'ar_subledger_code' => $r['AR_Subledger_Code'] ?? null,
            'currency_code' => $r['Currency_Code'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    /**
     * Parse OData date format /Date(milliseconds)/ to date string.
     */
    private function parseODataDate(?string $dateString): ?string
    {
        if (empty($dateString)) {
            return null;
        }

        if (preg_match('/\/Date\((\d+)\)\//', $dateString, $m)) {
            return Carbon::createFromTimestampMsUTC((int) $m[1])->toDateString();
        }

        return null;
    }

    /**
     * Handle a job failure.
     */
    public function failed(Throwable $exception): void
    {
        Log::error('LoadArPostedInvoices: Job failed permanently after all retries', [
            'error' => $exception->getMessage(),
            'attempts' => $this->attempts()
        ]);
    }

    /**
     * Calculate the number of seconds to wait before retrying the job.
     */
    public function backoff(): array
    {
        return [60, 120, 240];
    }
}
