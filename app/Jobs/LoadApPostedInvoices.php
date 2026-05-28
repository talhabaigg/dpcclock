<?php

namespace App\Jobs;

use App\Models\ApPostedInvoice;
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

class LoadApPostedInvoices implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    private const JOB_NAME = 'ap_posted_invoices';

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
        $lastDate = $this->forceFullSync ? null : $syncLog->last_filter_value;
        $isIncremental = $lastDate !== null;

        Log::info('LoadApPostedInvoices: Job started', [
            'mode' => $isIncremental ? 'incremental' : 'full',
            'filter_from' => $lastDate,
        ]);

        try {
            $totalProcessed = 0;
            $maxDate = $lastDate;
            $tableCleared = false;

            if ($this->forceFullSync) {
                // Full sync walks the date range in monthly windows — Premier's OData 500s
                // on unbounded queries regardless of $top, but handles filtered windows fine.
                $windows = $this->buildMonthlyWindows(
                    config('premier.jobs.full_sync_start_date', '2000-01-01'),
                    now()
                );
                Log::info('LoadApPostedInvoices: Full sync window plan', ['windows' => count($windows)]);
            } else {
                if ($isIncremental) {
                    $deleted = ApPostedInvoice::where('transaction_date', '>=', $lastDate)->delete();
                    Log::info('LoadApPostedInvoices: Deleted overlap records', ['from' => $lastDate, 'deleted' => $deleted]);
                    $tableCleared = true;
                }
                $windows = [[$lastDate, null]];
            }

            foreach ($windows as [$start, $end]) {
                $this->fetchWindow($start, $end, $totalProcessed, $maxDate, $tableCleared);
            }

            if ($this->forceFullSync && ! $tableCleared) {
                Log::warning('LoadApPostedInvoices: ERP returned 0 rows across all windows, table left untouched');
            }

            $syncLog->last_successful_sync = now();
            $syncLog->last_filter_value = $maxDate;
            $syncLog->records_synced = $totalProcessed;
            $syncLog->save();

            $duration = now()->diffInSeconds($startTime);
            Log::info('LoadApPostedInvoices: Job completed successfully', [
                'mode' => $isIncremental ? 'incremental' : 'full',
                'records_processed' => $totalProcessed,
                'max_date' => $maxDate,
                'duration_seconds' => $duration,
            ]);

        } catch (Throwable $e) {
            Log::error('LoadApPostedInvoices: Job failed', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            throw $e;
        }
    }

    private function fetchWindow(?string $start, ?string $end, int &$totalProcessed, ?string &$maxDate, bool &$tableCleared): void
    {
        $baseUrl = config('premier.api.base_url').config('premier.endpoints.ap_posted_invoices');
        $insertBatchSize = 100;
        $pageSize = 200;
        $skip = 0;

        $filterParts = [];
        if ($start !== null) {
            $filterParts[] = "Transaction_Date ge datetime'{$start}T00:00:00'";
        }
        if ($end !== null) {
            $filterParts[] = "Transaction_Date lt datetime'{$end}T00:00:00'";
        }
        $filterString = implode(' and ', $filterParts);

        $fetched = 0;
        $totalCount = null;

        do {
            $query = [];
            if ($filterString !== '') {
                $query[] = '$filter='.rawurlencode($filterString);
            }
            $query[] = '$top='.$pageSize;
            $query[] = '$skip='.$skip;
            $query[] = '$inlinecount=allpages';
            $url = $baseUrl.'?'.implode('&', $query);

            Log::info('LoadApPostedInvoices: Fetching page', [
                'window_start' => $start,
                'window_end' => $end,
                'skip' => $skip,
                'expected_total' => $totalCount,
            ]);

            // Premier's OData randomly 500s on valid queries — retry transient failures.
            $response = Http::timeout(config('premier.api.timeout', 300))
                ->retry(3, 1000, throw: false)
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

            if (! isset($json['d'])) {
                throw new \RuntimeException('Invalid API response structure: missing "d" property');
            }

            $rows = $json['d']['results'] ?? array_values($json['d'] ?? []);
            $totalCount ??= isset($json['d']['__count']) ? (int) $json['d']['__count'] : null;
            unset($json);

            if (! is_array($rows)) {
                throw new \RuntimeException('Invalid API response: expected array of rows');
            }

            $rowCount = count($rows);

            if ($rowCount === 0) {
                break;
            }

            // Defer the destructive full-sync truncate until we've actually received data.
            if (! $tableCleared) {
                ApPostedInvoice::query()->delete();
                $tableCleared = true;
                Log::info('LoadApPostedInvoices: Cleared table prior to full sync insert');
            }

            $chunks = array_chunk($rows, $insertBatchSize);
            unset($rows);

            foreach ($chunks as $chunk) {
                $data = [];
                foreach ($chunk as $r) {
                    $record = $this->mapRowToRecord($r);

                    if ($record['transaction_date'] && ($maxDate === null || $record['transaction_date'] > $maxDate)) {
                        $maxDate = $record['transaction_date'];
                    }

                    $data[] = $record;
                }
                ApPostedInvoice::insert($data);
                unset($data);
            }
            unset($chunks);

            $totalProcessed += $rowCount;
            $fetched += $rowCount;
            $skip += $pageSize;

            gc_collect_cycles();

        } while ($totalCount !== null && $fetched < $totalCount);
    }

    private function buildMonthlyWindows(string $startDate, Carbon $endDate): array
    {
        $cursor = Carbon::parse($startDate)->startOfMonth();
        $stop = $endDate->copy()->startOfMonth()->addMonth();

        $windows = [];
        while ($cursor < $stop) {
            $next = $cursor->copy()->addMonth();
            $windows[] = [$cursor->toDateString(), $next->toDateString()];
            $cursor = $next;
        }

        return $windows;
    }

    private function mapRowToRecord(array $r): array
    {
        return [
            'client_id' => $r['ClientId'] ?? null,
            'company' => $r['Company'] ?? null,
            'vendor_code' => $r['Vendor_Code'] ?? null,
            'vendor' => $r['Vendor'] ?? null,
            'invoice_number' => $r['Invoice_Number'] ?? null,
            'unique_id' => $r['Unique_ID'] ?? null,
            'job_number' => $r['Job_Number'] ?? null,
            'po_number' => $r['PO__'] ?? null,
            'sub_number' => $r['SUB__'] ?? null,
            'invoice_date' => $this->parseODataDate($r['Invoice_Date'] ?? null),
            'due_date' => $this->parseODataDate($r['Due_Date'] ?? null),
            'received_date' => $this->parseODataDate($r['Received_Date'] ?? null),
            'transaction_date' => $this->parseODataDate($r['Transaction_Date'] ?? null),
            'subtotal' => isset($r['Subtotal']) ? (float) $r['Subtotal'] : null,
            'tax1' => isset($r['Tax1']) ? (float) $r['Tax1'] : null,
            'tax2' => isset($r['Tax2']) ? (float) $r['Tax2'] : null,
            'freight' => isset($r['Freight']) ? (float) $r['Freight'] : null,
            'discount' => isset($r['Discount']) ? (float) $r['Discount'] : null,
            'retainage' => isset($r['Retainage']) ? (float) $r['Retainage'] : null,
            'invoice_total' => isset($r['Invoice_Total']) ? (float) $r['Invoice_Total'] : null,
            'purchase_category' => $r['Purchase_Category'] ?? null,
            'invoice_status' => $r['Invoice_Status'] ?? null,
            'hold_code' => $r['Hold_Code'] ?? null,
            'hold_date' => $this->parseODataDate($r['Hold_Date'] ?? null),
            'release_date' => $this->parseODataDate($r['Release_Date'] ?? null),
            'approval_date' => $this->parseODataDate($r['Approval_Date'] ?? null),
            'approval_status' => $r['Approval_Status'] ?? null,
            'notes' => $r['Notes'] ?? null,
            'memo' => $r['Memo'] ?? null,
            'key' => $r['Key'] ?? null,
            'batch' => $r['Batch'] ?? null,
            'created_by' => $r['Created_by'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

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

    public function failed(Throwable $exception): void
    {
        Log::error('LoadApPostedInvoices: Job failed permanently after all retries', [
            'error' => $exception->getMessage(),
            'attempts' => $this->attempts(),
        ]);
    }

    public function backoff(): array
    {
        return [60, 120, 240];
    }
}
