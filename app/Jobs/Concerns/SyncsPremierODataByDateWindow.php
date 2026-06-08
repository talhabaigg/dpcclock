<?php

namespace App\Jobs\Concerns;

use App\Models\DataSyncLog;
use Carbon\Carbon;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
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

    public function middleware(): array
    {
        // Lock keyed by jobName() so different sync types still run in parallel,
        // but two LoadJobCostData (etc.) can never race on the same __staging table.
        // expireAfter must exceed the job's $timeout so a healthy long-run never loses its lock.
        return [
            (new WithoutOverlapping($this->jobName()))
                ->expireAfter((int) config('premier.jobs.timeout', 1800) + 60)
                ->dontRelease(),
        ];
    }

    protected function runSync(): void
    {
        $startTime = now();
        $jobName = $this->jobName();
        $modelClass = $this->modelClass();
        $liveTable = (new $modelClass)->getTable();
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

        $stagingTable = $this->createStagingTable($liveTable, $logPrefix);
        $totalProcessed = 0;
        $maxDate = $lastFilterValue;

        try {
            $windows = $this->buildMonthlyWindows($cutoffDate, now());
            Log::info("{$logPrefix}: Window plan", ['windows' => count($windows)]);

            foreach ($windows as [$start, $end]) {
                $this->fetchWindow($start, $end, $stagingTable, $totalProcessed, $maxDate, $logPrefix);
            }

            if ($totalProcessed === 0) {
                if ($this->mode === 'full') {
                    Log::warning("{$logPrefix}: ERP returned 0 rows across all windows, live table left untouched");
                } else {
                    Log::info("{$logPrefix}: No rows returned, live table left untouched");
                }
                DB::statement("DROP TABLE IF EXISTS `{$stagingTable}`");
            } elseif ($this->mode === 'full') {
                $this->swapFull($liveTable, $stagingTable, $logPrefix);
            } else {
                $this->swapIncremental($liveTable, $stagingTable, $dbDateColumn, $cutoffDate, $logPrefix);
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
            DB::statement("DROP TABLE IF EXISTS `{$stagingTable}`");

            Log::error("{$logPrefix}: Job failed", [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            throw $e;
        }
    }

    private function createStagingTable(string $liveTable, string $logPrefix): string
    {
        $staging = $liveTable.'__staging';
        DB::statement("DROP TABLE IF EXISTS `{$staging}`");
        DB::statement("CREATE TABLE `{$staging}` LIKE `{$liveTable}`");
        Log::info("{$logPrefix}: Staging table prepared", ['table' => $staging]);

        return $staging;
    }

    private function swapFull(string $liveTable, string $stagingTable, string $logPrefix): void
    {
        $oldTable = $liveTable.'__old';
        DB::statement("DROP TABLE IF EXISTS `{$oldTable}`");
        DB::statement("RENAME TABLE `{$liveTable}` TO `{$oldTable}`, `{$stagingTable}` TO `{$liveTable}`");
        DB::statement("DROP TABLE `{$oldTable}`");
        Log::info("{$logPrefix}: Atomic rename swap completed");
    }

    private function swapIncremental(string $liveTable, string $stagingTable, string $dbDateColumn, string $cutoffDate, string $logPrefix): void
    {
        // Copy explicit columns excluding `id`: staging's auto-increment restarts at 1,
        // so `SELECT *` would carry ids that collide with retained rows < cutoff in live.
        $columnList = collect(Schema::getColumnListing($stagingTable))
            ->reject(fn (string $col) => $col === 'id')
            ->map(fn (string $col) => "`{$col}`")
            ->implode(', ');

        DB::transaction(function () use ($liveTable, $stagingTable, $dbDateColumn, $cutoffDate, $columnList) {
            DB::table($liveTable)->where($dbDateColumn, '>=', $cutoffDate)->delete();
            DB::statement("INSERT INTO `{$liveTable}` ({$columnList}) SELECT {$columnList} FROM `{$stagingTable}`");
        });
        DB::statement("DROP TABLE `{$stagingTable}`");
        Log::info("{$logPrefix}: Incremental delete+copy swap completed", ['from' => $cutoffDate]);
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

    private function fetchWindow(?string $start, ?string $end, string $stagingTable, int &$totalProcessed, ?string &$maxDate, string $logPrefix): void
    {
        $baseUrl = config('premier.api.base_url').config('premier.endpoints.'.$this->endpointConfigKey());
        $dbDateColumn = $this->dbDateColumn();
        $oDataDateColumn = $this->oDataDateColumn();
        $insertBatchSize = 500;

        // Adaptive page size:
        //   Start at 200 (largest payload Premier reliably serves) and halve down to 50
        //   only when a specific window/endpoint reproducibly 500s at the bigger size.
        //   The HTTP retry helper already exhausts transient retries before we get here.
        $pageSize = 200;
        $minPageSize = 50;
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
        // When Premier issues a server-side continuation (OData v2 __next URL) we follow it.
        // That bypasses $skip's O(N) scan cost on the tail of large result sets and is the
        // dominant speedup on full syncs.
        $nextUrl = null;

        do {
            if ($nextUrl !== null) {
                $url = $nextUrl;
            } else {
                $query = [];
                if ($filterString !== '') {
                    $query[] = '$filter='.rawurlencode($filterString);
                }
                $query[] = '$top='.$pageSize;
                $query[] = '$skip='.$skip;
                // $inlinecount only on the first page — Premier pays server-side aggregation
                // cost on every page it sees this flag, and we only need the total once.
                if ($skip === 0 && $totalCount === null) {
                    $query[] = '$inlinecount=allpages';
                }
                $url = $baseUrl.'?'.implode('&', $query);
            }

            Log::info("{$logPrefix}: Fetching page", [
                'window_start' => $start,
                'window_end' => $end,
                'skip' => $skip,
                'page_size' => $pageSize,
                'used_next_link' => $nextUrl !== null,
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
                // Adaptive fallback: persistent 500 at current size → halve and retry the
                // same offset. Only kicks in for our own $skip-based requests; we can't
                // reduce page size on a Premier-supplied continuation URL.
                if ($e->response->serverError() && $pageSize > $minPageSize && $nextUrl === null) {
                    $newPageSize = max($minPageSize, (int) ($pageSize / 2));
                    Log::warning("{$logPrefix}: Premier 500ed at \$top={$pageSize}, dropping to {$newPageSize}", [
                        'skip' => $skip,
                    ]);
                    $pageSize = $newPageSize;
                    continue;
                }
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
            $nextRaw = $json['d']['__next'] ?? null;
            // Premier may return absolute or relative URLs; normalise.
            $nextUrl = $nextRaw && ! str_starts_with($nextRaw, 'http')
                ? rtrim(config('premier.api.base_url'), '/').'/'.ltrim($nextRaw, '/')
                : $nextRaw;
            unset($json);

            if (! is_array($rows)) {
                throw new \RuntimeException('Invalid API response: expected array of rows');
            }

            $rowCount = count($rows);

            if ($rowCount === 0) {
                break;
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
                DB::table($stagingTable)->insert($data);
                unset($data);
            }

            $totalProcessed += $rowCount;
            $fetched += $rowCount;
            // Advance $skip by actual rows received (not assumed $pageSize) so a partial
            // page doesn't desync us if we ever fall back from __next to $skip mid-window.
            $skip += $rowCount;

            unset($rows);
            gc_collect_cycles();

            // Stop conditions:
            //   1. Premier explicitly told us there are no more rows (no __next, partial page)
            //   2. Total count from page 1 is satisfied
            if ($nextUrl === null && $rowCount < $pageSize) {
                break;
            }
            if ($totalCount !== null && $fetched >= $totalCount) {
                break;
            }
        } while (true);
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
