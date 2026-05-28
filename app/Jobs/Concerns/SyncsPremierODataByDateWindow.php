<?php

namespace App\Jobs\Concerns;

use App\Models\DataSyncLog;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

trait SyncsPremierODataByDateWindow
{
    public const MODES = ['incremental', 'last_30', 'last_60', 'full'];

    public string $mode;

    abstract protected function jobName(): string;

    abstract protected function endpointConfigKey(): string;

    abstract protected function modelClass(): string;

    abstract protected function oDataDateColumn(): string;

    abstract protected function dbDateColumn(): string;

    abstract protected function mapRowToRecord(array $r): array;

    protected function runSync(): void
    {
        $startTime = now();
        $jobName = $this->jobName();
        $modelClass = $this->modelClass();
        $dbDateColumn = $this->dbDateColumn();
        $logPrefix = class_basename(static::class);

        $syncLog = DataSyncLog::firstOrNew(['job_name' => $jobName]);
        $lastFilterValue = $syncLog->last_filter_value;

        $cutoffDate = $this->resolveCutoffDate($lastFilterValue, $logPrefix);

        Log::info("{$logPrefix}: Job started", [
            'mode' => $this->mode,
            'cutoff' => $cutoffDate,
            'last_filter_value' => $lastFilterValue,
        ]);

        try {
            $totalProcessed = 0;
            $maxDate = $lastFilterValue;
            $tableCleared = false;

            if ($this->mode === 'full') {
                // Defer the truncate until first window returns data so an API failure
                // on early windows doesn't leave the table empty.
                $windows = $this->buildMonthlyWindows($cutoffDate, now());
                Log::info("{$logPrefix}: Full reset window plan", ['windows' => count($windows)]);
            } else {
                $deleted = $modelClass::where($dbDateColumn, '>=', $cutoffDate)->delete();
                Log::info("{$logPrefix}: Deleted overlap records", ['from' => $cutoffDate, 'deleted' => $deleted]);
                $tableCleared = true;
                $windows = $this->buildMonthlyWindows($cutoffDate, now());
            }

            foreach ($windows as [$start, $end]) {
                $this->fetchWindow($start, $end, $totalProcessed, $maxDate, $tableCleared, $logPrefix);
            }

            if ($this->mode === 'full' && ! $tableCleared) {
                Log::warning("{$logPrefix}: ERP returned 0 rows across all windows, table left untouched");
            }

            $syncLog->last_successful_sync = now();
            $syncLog->last_filter_value = $maxDate;
            $syncLog->records_synced = $totalProcessed;
            $syncLog->save();

            $duration = now()->diffInSeconds($startTime);
            Log::info("{$logPrefix}: Job completed successfully", [
                'mode' => $this->mode,
                'records_processed' => $totalProcessed,
                'max_date' => $maxDate,
                'duration_seconds' => $duration,
            ]);

        } catch (Throwable $e) {
            Log::error("{$logPrefix}: Job failed", [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            throw $e;
        }
    }

    private function resolveCutoffDate(?string $lastFilterValue, string $logPrefix): string
    {
        // Incremental on a fresh table has no anchor; fall back to last-60 so we seed sanely.
        if ($this->mode === 'incremental' && $lastFilterValue === null) {
            Log::info("{$logPrefix}: First sync, falling back from incremental to last_60");

            return Carbon::today()->subDays(60)->toDateString();
        }

        return match ($this->mode) {
            // 7-day backfill buffer catches transactions backdated into the recent past.
            'incremental' => Carbon::parse($lastFilterValue)->subDays(7)->toDateString(),
            'last_30' => Carbon::today()->subDays(30)->toDateString(),
            'last_60' => Carbon::today()->subDays(60)->toDateString(),
            'full' => config('premier.jobs.full_sync_start_date', '2025-01-01'),
        };
    }

    private function fetchWindow(?string $start, ?string $end, int &$totalProcessed, ?string &$maxDate, bool &$tableCleared, string $logPrefix): void
    {
        $baseUrl = config('premier.api.base_url').config('premier.endpoints.'.$this->endpointConfigKey());
        $modelClass = $this->modelClass();
        $dbDateColumn = $this->dbDateColumn();
        $oDataDateColumn = $this->oDataDateColumn();
        $insertBatchSize = 100;
        // Premier's OData reproducibly 500s on certain windows at $top=100/200; $top=50 is most reliable.
        $pageSize = 50;
        $skip = 0;

        $filterParts = [];
        if ($start !== null) {
            $filterParts[] = "{$oDataDateColumn} ge datetime'{$start}T00:00:00'";
        }
        if ($end !== null) {
            $filterParts[] = "{$oDataDateColumn} lt datetime'{$end}T00:00:00'";
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

            Log::info("{$logPrefix}: Fetching page", [
                'window_start' => $start,
                'window_end' => $end,
                'skip' => $skip,
                'expected_total' => $totalCount,
            ]);

            try {
                $response = Http::timeout(config('premier.api.timeout', 300))
                    ->retry([1000, 2000, 5000, 10000, 20000, 30000], throw: true, when: function (\Throwable $exception): bool {
                        return $exception instanceof \Illuminate\Http\Client\ConnectionException
                            || ($exception instanceof \Illuminate\Http\Client\RequestException
                                && $exception->response->serverError());
                    })
                    ->withBasicAuth(
                        config('premier.api.username'),
                        config('premier.api.password')
                    )
                    ->withHeaders([
                        'Accept' => 'application/json',
                        'DataServiceVersion' => '2.0',
                        'MaxDataServiceVersion' => '2.0',
                    ])
                    ->throw()
                    ->get($url);
            } catch (\Illuminate\Http\Client\RequestException $e) {
                throw new \RuntimeException(
                    "API request failed with status {$e->response->status()} after retries: {$e->response->body()}"
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

            if (! $tableCleared) {
                $modelClass::query()->delete();
                $tableCleared = true;
                Log::info("{$logPrefix}: Cleared table prior to full sync insert");
            }

            foreach (array_chunk($rows, $insertBatchSize) as $chunk) {
                $data = [];
                foreach ($chunk as $r) {
                    $record = $this->mapRowToRecord($r);

                    if (isset($record[$dbDateColumn]) && $record[$dbDateColumn] && ($maxDate === null || $record[$dbDateColumn] > $maxDate)) {
                        $maxDate = $record[$dbDateColumn];
                    }

                    $data[] = $record;
                }
                $modelClass::insert($data);
                unset($data);
            }

            $totalProcessed += $rowCount;
            $fetched += $rowCount;
            $skip += $pageSize;

            unset($rows);
            gc_collect_cycles();

        } while ($totalCount !== null && $fetched < $totalCount);
    }

    private function buildMonthlyWindows(string $startDate, Carbon $endDate): array
    {
        $cutoff = Carbon::parse($startDate);
        $cursor = $cutoff->copy()->startOfMonth();
        $stop = $endDate->copy()->startOfMonth()->addMonth();

        $windows = [];
        $isFirst = true;
        while ($cursor < $stop) {
            $next = $cursor->copy()->addMonth();
            // First window starts at the actual cutoff so we don't re-fetch data still in the table.
            $windowStart = $isFirst ? $cutoff->toDateString() : $cursor->toDateString();
            $windows[] = [$windowStart, $next->toDateString()];
            $cursor = $next;
            $isFirst = false;
        }

        return $windows;
    }
}
