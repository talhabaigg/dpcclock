<?php

namespace App\Jobs;

use App\Models\ApPostedInvoiceLine;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class LoadApPostedInvoiceLines implements ShouldQueue
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
        Log::info('LoadApPostedInvoiceLines: Job started');

        try {
            $baseUrl = config('premier.api.base_url') . config('premier.endpoints.ap_posted_invoice_lines');
            $insertBatchSize = 100;
            $pageSize = 200;
            $skip = 0;
            $totalProcessed = 0;
            $isFirstBatch = true;

            do {
                $url = $baseUrl . '?$top=' . $pageSize . '&$skip=' . $skip;

                Log::info("LoadApPostedInvoiceLines: Fetching page", [
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
                    Log::warning('LoadApPostedInvoiceLines: ERP returned 0 rows, skipping database update');
                    return;
                }

                if ($rowCount === 0) {
                    break;
                }

                Log::info('LoadApPostedInvoiceLines: Processing page', [
                    'rows' => $rowCount,
                    'skip' => $skip
                ]);

                if ($isFirstBatch) {
                    ApPostedInvoiceLine::query()->delete();
                    $isFirstBatch = false;
                }

                $chunks = array_chunk($rows, $insertBatchSize);
                unset($rows);

                foreach ($chunks as $chunk) {
                    $data = [];
                    foreach ($chunk as $r) {
                        $data[] = $this->mapRowToRecord($r);
                    }
                    ApPostedInvoiceLine::insert($data);
                    unset($data);
                }
                unset($chunks);

                $totalProcessed += $rowCount;
                $skip += $pageSize;

                gc_collect_cycles();

            } while ($rowCount === $pageSize);

            $duration = now()->diffInSeconds($startTime);
            Log::info('LoadApPostedInvoiceLines: Job completed successfully', [
                'records_processed' => $totalProcessed,
                'duration_seconds' => $duration
            ]);

        } catch (Throwable $e) {
            Log::error('LoadApPostedInvoiceLines: Job failed', [
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
            'client_id' => $r['Client_Id'] ?? null,
            'company_code' => $r['Company_Code'] ?? null,
            'company_name' => $r['Company_Name'] ?? null,
            'header_job' => $r['Header_Job'] ?? null,
            'purchase_category' => $r['Purchase_Category'] ?? null,
            'sub_contract' => $r['SubContract'] ?? null,
            'transaction_date' => $this->parseODataDate($r['Transaction_Date'] ?? null),
            'invoice_status' => $r['Invoice_Status'] ?? null,
            'ap_subledger' => $r['AP_Subledger'] ?? null,
            'vendor_code' => $r['Vendor_Code'] ?? null,
            'vendor' => $r['Vendor'] ?? null,
            'invoice_number' => $r['Invoice_Number'] ?? null,
            'invoice_unique_id' => $r['Invoice_Unique_ID'] ?? null,
            'line_number' => isset($r['Line_Number']) ? (int) $r['Line_Number'] : null,
            'line_company' => $r['Line_Company'] ?? null,
            'distribution_type' => $r['Distribution_Type'] ?? null,
            'line_job' => $r['Line_Job'] ?? null,
            'cost_item' => $r['Cost_Item'] ?? null,
            'cost_type' => $r['Cost_Type'] ?? null,
            'department' => $r['Department'] ?? null,
            'location' => $r['Location'] ?? null,
            'gl_account' => $r['GL_Account'] ?? null,
            'sub_account' => $r['Sub_Account'] ?? null,
            'division' => $r['Division'] ?? null,
            'inventory_subledger' => $r['Inventory_Subledger'] ?? null,
            'warehouse' => $r['Warehouse'] ?? null,
            'warehouse_location' => $r['Warehouse_Location'] ?? null,
            'line_description' => $r['Line_Description'] ?? null,
            'quantity' => isset($r['Quantity']) ? (float) $r['Quantity'] : null,
            'uofm' => $r['UofM'] ?? null,
            'unit_cost' => isset($r['Unit_Cost']) ? (float) $r['Unit_Cost'] : null,
            'amount' => isset($r['Amount']) ? (float) $r['Amount'] : null,
            'tax_group' => $r['Tax_Group'] ?? null,
            'tax1' => isset($r['Tax1']) ? (float) $r['Tax1'] : null,
            'tax2' => isset($r['Tax2']) ? (float) $r['Tax2'] : null,
            'expense' => isset($r['Expense']) ? (float) $r['Expense'] : null,
            'equipment' => $r['Equipment'] ?? null,
            'occupation' => $r['Occupation'] ?? null,
            'pay_code' => $r['Pay_Code'] ?? null,
            'item' => $r['Item'] ?? null,
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
        Log::error('LoadApPostedInvoiceLines: Job failed permanently after all retries', [
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
