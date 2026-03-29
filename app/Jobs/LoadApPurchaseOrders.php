<?php

namespace App\Jobs;

use App\Models\ApPurchaseOrder;
use App\Models\DataSyncLog;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class LoadApPurchaseOrders implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    private const JOB_NAME = 'ap_purchase_orders';

    public $tries;

    public $timeout;

    public bool $forceFullSync;

    public function __construct(bool $forceFullSync = false)
    {
        $this->tries = config('premier.jobs.retry_times', 3);
        $this->timeout = config('premier.jobs.timeout', 600);
        $this->forceFullSync = $forceFullSync;
    }

    public function handle(): void
    {
        $startTime = now();
        $syncLog = DataSyncLog::firstOrNew(['job_name' => self::JOB_NAME]);
        $isIncremental = ! $this->forceFullSync && $syncLog->last_successful_sync !== null;

        // Always load last 30 days to catch backdated POs
        $filterDate = $isIncremental
            ? Carbon::now()->subDays(30)->toDateString()
            : null;

        Log::info('LoadApPurchaseOrders: Job started', [
            'mode' => $isIncremental ? 'incremental (last 30 days)' : 'full',
            'filter_from' => $filterDate,
        ]);

        try {
            $baseUrl = config('premier.api.base_url').config('premier.endpoints.ap_purchase_orders');
            $insertBatchSize = 100;
            $pageSize = 200;
            $skip = 0;
            $totalProcessed = 0;
            $isFirstBatch = true;
            $maxDate = $syncLog->last_filter_value;

            // Build the OData filter for incremental mode — last 30 days
            $filterParam = '';
            if ($isIncremental) {
                $filterParam = "\$filter=PO_Date ge datetime'".$filterDate."T00:00:00'&";
            }

            // Delete overlap records before fetching (incremental mode)
            if ($isIncremental) {
                $deleted = ApPurchaseOrder::where('po_date', '>=', $filterDate)->delete();
                Log::info('LoadApPurchaseOrders: Deleted overlap records', ['from' => $lastDate, 'deleted' => $deleted]);
            }

            do {
                $url = $baseUrl.'?'.$filterParam.'$top='.$pageSize.'&$skip='.$skip;

                Log::info('LoadApPurchaseOrders: Fetching page', [
                    'skip' => $skip,
                    'top' => $pageSize,
                    'incremental' => $isIncremental,
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

                if (! $response->successful()) {
                    throw new \RuntimeException(
                        "API request failed with status {$response->status()}: {$response->body()}"
                    );
                }

                $json = $response->json();
                unset($response);

                // Handle OData v2 response formats: d.results, d (direct array), or v4 value
                $rows = $json['d']['results'] ?? (isset($json['d']) && is_array($json['d']) ? $json['d'] : ($json['value'] ?? []));
                unset($json);

                if (! is_array($rows)) {
                    throw new \RuntimeException('Invalid API response: expected array of rows');
                }

                $rowCount = count($rows);

                if ($rowCount === 0 && $isFirstBatch && ! $isIncremental) {
                    Log::warning('LoadApPurchaseOrders: ERP returned 0 rows, skipping database update');

                    return;
                }

                if ($rowCount === 0) {
                    break;
                }

                Log::info('LoadApPurchaseOrders: Processing page', [
                    'rows' => $rowCount,
                    'skip' => $skip,
                ]);

                // Delete all on first batch (full replace) only for full sync
                if ($isFirstBatch && ! $isIncremental) {
                    ApPurchaseOrder::query()->delete();
                }
                $isFirstBatch = false;

                $chunks = array_chunk($rows, $insertBatchSize);
                unset($rows);

                foreach ($chunks as $chunk) {
                    $data = [];
                    foreach ($chunk as $r) {
                        $record = $this->mapRowToRecord($r);

                        if ($record['po_date'] && ($maxDate === null || $record['po_date'] > $maxDate)) {
                            $maxDate = $record['po_date'];
                        }

                        $data[] = $record;
                    }
                    ApPurchaseOrder::insert($data);
                    unset($data);
                }
                unset($chunks);

                $totalProcessed += $rowCount;
                $skip += $pageSize;

                gc_collect_cycles();

            } while ($rowCount === $pageSize);

            // Update sync log
            $syncLog->last_successful_sync = now();
            $syncLog->last_filter_value = $maxDate;
            $syncLog->records_synced = $totalProcessed;
            $syncLog->save();

            $duration = now()->diffInSeconds($startTime);
            Log::info('LoadApPurchaseOrders: Job completed successfully', [
                'mode' => $isIncremental ? 'incremental' : 'full',
                'records_processed' => $totalProcessed,
                'max_date' => $maxDate,
                'duration_seconds' => $duration,
            ]);

        } catch (Throwable $e) {
            Log::error('LoadApPurchaseOrders: Job failed', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            throw $e;
        }
    }

    private function mapRowToRecord(array $r): array
    {
        return [
            'client_id' => $r['ClientId'] ?? null,
            'company' => $r['Company'] ?? null,
            'job_number' => $r['Job_Number'] ?? null,
            'po_number' => $r['PO_Number'] ?? null,
            'po_date' => $this->parseDate($r['PO_Date'] ?? null),
            'po_required_date' => $this->parseDate($r['PO_Required_Date'] ?? null),
            'line' => $r['Line'] ?? null,
            'item_code' => $r['Item_Code'] ?? null,
            'cost_item' => $r['Cost_Item'] ?? null,
            'cost_type' => $r['Cost_Type'] ?? null,
            'department' => $r['Department'] ?? null,
            'location' => $r['Location'] ?? null,
            'vendor_code' => $r['Vendor_Code'] ?? null,
            'vendor_name' => $r['VendorName'] ?? null,
            'description' => $r['Description'] ?? null,
            'qty' => isset($r['Qty']) ? (float) $r['Qty'] : 0,
            'uofm' => $r['UofM'] ?? null,
            'unit_cost' => isset($r['Unit_Cost']) ? (float) $r['Unit_Cost'] : 0,
            'amount' => isset($r['Amount']) ? (float) $r['Amount'] : 0,
            'created_by' => $r['CreatedBy'] ?? null,
            'ship_to_type' => $r['Ship_To_Type'] ?? null,
            'status' => $r['Status'] ?? null,
            'approval_status' => $r['Approval_Status'] ?? null,
            'key' => $r['Key'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    private function parseDate(?string $dateString): ?string
    {
        if (empty($dateString)) {
            return null;
        }

        // Handle OData v2 date format: /Date(milliseconds)/
        if (preg_match('/\/Date\((\d+)\)\//', $dateString, $m)) {
            return Carbon::createFromTimestampMsUTC((int) $m[1])->toDateString();
        }

        // Handle ISO date format: 2026-04-01T00:00:00
        try {
            return Carbon::parse($dateString)->toDateString();
        } catch (\Exception $e) {
            return null;
        }
    }

    public function failed(Throwable $exception): void
    {
        Log::error('LoadApPurchaseOrders: Job failed permanently after all retries', [
            'error' => $exception->getMessage(),
            'attempts' => $this->attempts(),
        ]);
    }

    public function backoff(): array
    {
        return [60, 120, 240];
    }
}
