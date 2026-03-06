<?php

namespace App\Jobs;

use App\Models\DataSyncLog;
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

class LoadJobCostData implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    private const JOB_NAME = 'job_cost_data';

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

        Log::info('LoadJobCostDetails: Job started', [
            'mode' => $isIncremental ? 'incremental' : 'full',
            'filter_from' => $lastDate,
        ]);

        try {
            $baseUrl = config('premier.api.base_url').config('premier.endpoints.job_cost_details');
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
                $deleted = JobCostDetail::where('transaction_date', '>=', $lastDate)->delete();
                Log::info('LoadJobCostDetails: Deleted overlap records', ['from' => $lastDate, 'deleted' => $deleted]);
            }

            do {
                $url = $baseUrl.'?'.$filterParam.'$top='.$pageSize.'&$skip='.$skip;

                Log::info('LoadJobCostDetails: Fetching page', [
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
                    Log::warning('LoadJobCostDetails: ERP returned 0 rows, skipping database update');

                    return;
                }

                if ($rowCount === 0) {
                    break;
                }

                Log::info('LoadJobCostDetails: Processing page', [
                    'rows' => $rowCount,
                    'skip' => $skip,
                ]);

                if ($isFirstBatch && ! $isIncremental) {
                    JobCostDetail::query()->delete();
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

                        $data[] = $record;
                    }
                    JobCostDetail::insert($data);
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
            Log::info('LoadJobCostDetails: Job completed successfully', [
                'mode' => $isIncremental ? 'incremental' : 'full',
                'records_processed' => $totalProcessed,
                'max_date' => $maxDate,
                'duration_seconds' => $duration,
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

    private function mapRowToRecord(array $r): array
    {
        return [
            'job_number' => $r['Job_Number'] ?? null,
            'job_name' => $r['Job_Name'] ?? null,
            'cost_item' => $r['Cost_Item'] ?? null,
            'cost_type' => $r['Cost_Type'] ?? null,
            'transaction_date' => $this->parseODataDate($r['Transaction_Date'] ?? null),
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
        Log::error('LoadJobCostDetails: Job failed permanently after all retries', [
            'error' => $exception->getMessage(),
            'attempts' => $this->attempts(),
        ]);
    }

    public function backoff(): array
    {
        return [60, 120, 240];
    }
}
