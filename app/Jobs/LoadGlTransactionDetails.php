<?php

namespace App\Jobs;

use App\Models\DataSyncLog;
use App\Models\GlTransactionDetail;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class LoadGlTransactionDetails implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    private const JOB_NAME = 'gl_transaction_details';

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

        Log::info('LoadGlTransactionDetails: Job started', [
            'mode' => $isIncremental ? 'incremental' : 'full',
            'filter_from' => $lastDate,
        ]);

        try {
            $baseUrl = config('premier.api.base_url').'/GLTransactionDetails';
            $insertBatchSize = 100;
            $pageSize = 200;
            $skip = 0;
            $totalProcessed = 0;
            $isFirstBatch = true;
            $maxDate = $lastDate;

            $filterParam = '';
            if ($isIncremental) {
                $filterParam = "\$filter=Transaction_Date ge datetime'".$lastDate."T00:00:00'&";
            }

            // Delete overlap records before fetching (incremental mode)
            if ($isIncremental) {
                $deleted = GlTransactionDetail::where('transaction_date', '>=', $lastDate)->delete();
                Log::info('LoadGlTransactionDetails: Deleted overlap records', ['from' => $lastDate, 'deleted' => $deleted]);
            }

            do {
                $url = $baseUrl.'?'.$filterParam.'$top='.$pageSize.'&$skip='.$skip;

                Log::info('LoadGlTransactionDetails: Fetching page', [
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

                if (! isset($json['d'])) {
                    throw new \RuntimeException('Invalid API response structure: missing "d" property');
                }

                $rows = $json['d']['results'] ?? array_values($json['d'] ?? []);
                unset($json);

                if (! is_array($rows)) {
                    throw new \RuntimeException('Invalid API response: expected array of rows');
                }

                $rowCount = count($rows);

                if ($rowCount === 0 && $isFirstBatch && ! $isIncremental) {
                    Log::warning('LoadGlTransactionDetails: ERP returned 0 rows, skipping database update');

                    return;
                }

                if ($rowCount === 0) {
                    break;
                }

                Log::info('LoadGlTransactionDetails: Processing page', [
                    'rows' => $rowCount,
                    'skip' => $skip,
                ]);

                if ($isFirstBatch && ! $isIncremental) {
                    GlTransactionDetail::query()->delete();
                }
                $isFirstBatch = false;

                $chunks = array_chunk($rows, $insertBatchSize);
                unset($rows);

                foreach ($chunks as $chunk) {
                    $data = [];
                    foreach ($chunk as $r) {
                        $record = $this->mapRowToRecord($r);

                        if ($record['transaction_date'] && ($maxDate === null || $record['transaction_date'] > $maxDate)) {
                            $maxDate = $record['transaction_date'];
                        }

                        // Only store CSQ-related transactions
                        if (stripos($record['description'] ?? '', 'CSQ') !== false) {
                            $data[] = $record;
                        }
                    }
                    if (count($data) > 0) {
                        GlTransactionDetail::insert($data);
                    }
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
            Log::info('LoadGlTransactionDetails: Job completed successfully', [
                'mode' => $isIncremental ? 'incremental' : 'full',
                'records_processed' => $totalProcessed,
                'max_date' => $maxDate,
                'duration_seconds' => $duration,
            ]);

        } catch (Throwable $e) {
            Log::error('LoadGlTransactionDetails: Job failed', [
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
            'company_code' => $r['Company_Code'] ?? null,
            'transaction_date' => $this->parseDate($r['Transaction_Date'] ?? null),
            'journal_type' => $r['Journal_Type'] ?? null,
            'account' => $r['Account'] ?? null,
            'account_name' => $r['Account_Name'] ?? null,
            'sub_account' => $r['Sub_Account'] ?? null,
            'sub_account_name' => $r['Sub_Account_Name'] ?? null,
            'division' => $r['Division'] ?? null,
            'description' => $r['Description'] ?? null,
            'debit' => isset($r['Debit']) ? (float) $r['Debit'] : 0,
            'credit' => isset($r['Credit']) ? (float) $r['Credit'] : 0,
            'debit_for_currency' => isset($r['Debit_For_Currency']) ? (float) $r['Debit_For_Currency'] : 0,
            'credit_for_currency' => isset($r['Credit_For_Currency']) ? (float) $r['Credit_For_Currency'] : 0,
            'currency' => $r['Currency'] ?? null,
            'audit_number' => $r['Audit_Number'] ?? null,
            'reference_document_number' => $r['Reference_Doument_Number'] ?? null, // Note: typo in Premier API
            'source_is_journal_entry' => $r['Source_IsJournal_Entry'] ?? false,
            'company_from' => $r['Company_From'] ?? null,
            'company_to' => $r['Company_To'] ?? null,
            'update_user' => $r['Update_User'] ?? null,
            'update_date' => $this->parseDate($r['Update_Date'] ?? null, includeTime: true),
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    private function parseDate(?string $dateString, bool $includeTime = false): ?string
    {
        if (empty($dateString)) {
            return null;
        }

        // OData v2 format: /Date(1234567890000)/
        if (preg_match('/\/Date\((\d+)\)\//', $dateString, $m)) {
            $carbon = Carbon::createFromTimestampMsUTC((int) $m[1]);

            return $includeTime ? $carbon->toDateTimeString() : $carbon->toDateString();
        }

        // ISO format from some endpoints
        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $dateString)) {
            $carbon = Carbon::parse($dateString);

            return $includeTime ? $carbon->toDateTimeString() : $carbon->toDateString();
        }

        return null;
    }

    public function failed(Throwable $exception): void
    {
        Log::error('LoadGlTransactionDetails: Job failed permanently after all retries', [
            'error' => $exception->getMessage(),
            'attempts' => $this->attempts(),
        ]);
    }

    public function backoff(): array
    {
        return [60, 120, 240];
    }
}
