---
name: safe-sync-swap
description: Refactor a Premier OData sync job so it stages fetched rows in a shadow table and atomically swaps them in at the end — instead of truncating the live table before fetch, which leaves the app blind for the multi-minute sync window. Use when the user asks to "make sync safe", "stage and swap", "don't empty the table during sync", "no-downtime sync", "shadow table swap", refers to sync jobs going blank, or invokes `/safe-sync-swap` (optionally with a target job name).
---

# Safe Sync Swap

## Problem this skill solves

Premier data sync jobs in `app/Jobs/Load*.php` currently truncate the destination table at the start of receiving data, then re-insert page by page. During the multi-minute sync the table is mostly empty, so the app (cash forecast, project dashboard, GST report, etc.) reads garbage or zeros.

Concretely, this anti-pattern appears as either:

```php
// In SyncsPremierODataByDateWindow::fetchWindow()
if (! $tableCleared) {
    $modelClass::query()->delete();   // <-- empties the live table
    $tableCleared = true;
}
// ... then chunked inserts over many pages ...
```

or in standalone jobs:

```php
if ($isFirstBatch) {
    JobSummary::query()->delete();   // <-- same problem
}
$isFirstBatch = false;
// ... then chunked inserts ...
```

## Pattern to apply

**Stage into a shadow table, swap atomically at the end.**

1. Open the run with `CREATE TABLE {table}__staging LIKE {table}` (dropping any leftover from a prior failed run first).
2. Stream every page's chunked `insert()` into `{table}__staging` instead of the live table.
3. On the final successful page, run the swap inside a transaction:
   - For **full** mode: rename swap — `RENAME TABLE {table} TO {table}__old, {table}__staging TO {table}` then `DROP TABLE {table}__old`. This is near-instant on InnoDB.
   - For **incremental / last_30 / last_60**: `DELETE FROM {table} WHERE {date_col} >= {cutoff}; INSERT INTO {table} SELECT * FROM {table}__staging;` inside one DB transaction. This is the only window where the live table is briefly inconsistent, but it's bounded to a single fast SQL transaction (seconds, not minutes).
4. On any failure, drop `{table}__staging` and leave the live table untouched — the next retry starts clean.

Shadow-table naming: use a **double-underscore** suffix `__staging` (e.g. `job_cost_details__staging`). Avoid single underscore — too easy to confuse with a real model.

## Where to apply (current candidates as of 2026-06)

Trait-based jobs (fix the trait once, all benefit):
- [`app/Jobs/Concerns/SyncsPremierODataByDateWindow.php`](../../../app/Jobs/Concerns/SyncsPremierODataByDateWindow.php) — used by `LoadJobCostData`, `LoadApPostedInvoices`, `LoadApPostedInvoiceLines`, `LoadArPostedInvoices`, `LoadApPurchaseOrders`, `LoadGlTransactionDetails`

Standalone jobs (refactor each):
- [`app/Jobs/LoadJobSummaries.php`](../../../app/Jobs/LoadJobSummaries.php) — wipes `job_summaries`
- [`app/Jobs/LoadJobReportByCostItemAndCostTypes.php`](../../../app/Jobs/LoadJobReportByCostItemAndCostTypes.php) — wipes `job_report_by_cost_item_and_cost_types`
- [`app/Jobs/LoadArProgressBillingSummaries.php`](../../../app/Jobs/LoadArProgressBillingSummaries.php) — wipes `ar_progress_billing_summaries`
- [`app/Jobs/LoadJobVendorCommitments.php`](../../../app/Jobs/LoadJobVendorCommitments.php) — wipes `job_vendor_commitments`

Before refactoring a job, grep first to confirm the wipe still exists (`grep -n "query()->delete\|truncate" app/Jobs/<Job>.php`) — earlier passes of this skill may already have converted it.

## How to apply — step by step

When the user invokes this skill (with or without a target job), follow this exact flow:

### 1. Pick the target

- If the user named a job (`/safe-sync-swap LoadJobSummaries`), refactor that one.
- If they said "fix the trait" or named a trait-based job, refactor [`SyncsPremierODataByDateWindow.php`](../../../app/Jobs/Concerns/SyncsPremierODataByDateWindow.php) once.
- If unclear, list the candidates above and ask which.

### 2. Read the target

Read the whole file. Identify:
- The `$tableCleared`/`$isFirstBatch` wipe line — this is what we're removing.
- The model class and table name — `$model->getTable()` gives the live name.
- The date column for incremental mode (if applicable).
- Every `$modelClass::insert(...)` / `Model::insert(...)` call — these need to retarget the staging table.

### 3. Add a staging helper

Insert a small private helper that returns the staging table name and (re)creates it:

```php
private function createStagingTable(string $liveTable): string
{
    $staging = $liveTable . '__staging';
    DB::statement("DROP TABLE IF EXISTS `{$staging}`");
    DB::statement("CREATE TABLE `{$staging}` LIKE `{$liveTable}`");
    return $staging;
}
```

Use `\Illuminate\Support\Facades\DB`. Add the `use` if missing.

### 4. Retarget the inserts

Replace `Model::insert($data)` with `DB::table($stagingTable)->insert($data)`. Eloquent timestamps (`created_at` / `updated_at`) are already being set explicitly in `mapRowToRecord` for these jobs, so dropping down to the query builder is safe.

### 5. Swap at the end

After the page loop completes successfully, inside the same `try {}` block, run the swap. Two variants:

**Full mode (rename swap):**

```php
DB::statement("RENAME TABLE `{$liveTable}` TO `{$liveTable}__old`, `{$stagingTable}` TO `{$liveTable}`");
DB::statement("DROP TABLE `{$liveTable}__old`");
```

`RENAME TABLE` is atomic in MySQL — readers never see an empty table.

**Incremental / last_N mode (delete-window + copy-from-staging):**

```php
DB::transaction(function () use ($liveTable, $stagingTable, $dateColumn, $cutoffDate) {
    DB::table($liveTable)->where($dateColumn, '>=', $cutoffDate)->delete();
    DB::statement("INSERT INTO `{$liveTable}` SELECT * FROM `{$stagingTable}`");
});
DB::statement("DROP TABLE `{$stagingTable}`");
```

This still has a brief window of inconsistency, but it's bounded to the transaction commit — seconds, not the entire fetch duration.

### 6. Clean up on failure

In the `catch (Throwable $e)` block, drop the staging table before re-throwing:

```php
} catch (Throwable $e) {
    DB::statement("DROP TABLE IF EXISTS `{$stagingTable}`");
    Log::error(...);
    throw $e;
}
```

This means a failed run leaves the live table 100% untouched.

### 7. Note about `last_filter_value`

`DataSyncLog::last_filter_value` is only persisted *after* the swap completes successfully. A failed sync should not advance it — verify the `$syncLog->save()` call is reached only after the swap is done.

## Worked example — trait refactor

The trait is the highest-leverage target since six jobs use it. Here is the shape of the refactored `runSync()` (full mode only shown — incremental path follows the same pattern with the delete-window swap at the end):

```php
protected function runSync(): void
{
    $modelClass = $this->modelClass();
    $liveTable = (new $modelClass)->getTable();
    $dbDateColumn = $this->dbDateColumn();
    $logPrefix = class_basename(static::class);

    $syncLog = DataSyncLog::firstOrNew(['job_name' => $this->jobName()]);
    $cutoffDate = $this->resolveCutoffDate($syncLog->last_filter_value, $logPrefix);

    $stagingTable = $this->createStagingTable($liveTable);
    $totalProcessed = 0;
    $maxDate = $syncLog->last_filter_value;

    try {
        $windows = $this->buildMonthlyWindows($cutoffDate, now());
        foreach ($windows as [$start, $end]) {
            $this->fetchWindow($start, $end, $stagingTable, $dbDateColumn, $totalProcessed, $maxDate, $logPrefix);
        }

        if ($this->mode === 'full') {
            DB::statement("RENAME TABLE `{$liveTable}` TO `{$liveTable}__old`, `{$stagingTable}` TO `{$liveTable}`");
            DB::statement("DROP TABLE `{$liveTable}__old`");
        } else {
            DB::transaction(function () use ($liveTable, $stagingTable, $dbDateColumn, $cutoffDate) {
                DB::table($liveTable)->where($dbDateColumn, '>=', $cutoffDate)->delete();
                DB::statement("INSERT INTO `{$liveTable}` SELECT * FROM `{$stagingTable}`");
            });
            DB::statement("DROP TABLE `{$stagingTable}`");
        }

        $syncLog->last_successful_sync = now();
        $syncLog->last_filter_value = $maxDate;
        $syncLog->records_synced = $totalProcessed;
        $syncLog->save();
    } catch (Throwable $e) {
        DB::statement("DROP TABLE IF EXISTS `{$stagingTable}`");
        Log::error("{$logPrefix}: Job failed", ['error' => $e->getMessage()]);
        throw $e;
    }
}
```

And `fetchWindow` becomes a thin variant of itself — drop the `$tableCleared` parameter entirely, retarget the insert:

```php
// before
$modelClass::insert($data);
// after
DB::table($stagingTable)->insert($data);
```

## What NOT to do

- **Do not** wrap the entire sync in one DB transaction. The fetch is multi-minute and would hold long-running locks on the live table. The shadow-table approach exists exactly to avoid that.
- **Do not** use `TRUNCATE` on the live table at any point — it auto-commits and bypasses transactions. The rename swap is the only safe full-replace primitive here.
- **Do not** assume `RENAME TABLE` works inside a transaction. It implicitly commits. Run it as a standalone statement after staging is complete.
- **Do not** leave the staging table behind on success or failure — both paths must drop it. A leftover `__staging` table on next run will be `DROP TABLE IF EXISTS`'d by the helper, but the noise hides real issues.
- **Do not** skip the `__old` drop — without it, the second run fails with "table already exists".

## Verifying the change

1. `php artisan tinker` → run the job synchronously: `(new \App\Jobs\LoadJobSummaries('full'))->handle();`
2. While it runs, in a separate `tinker` window, repeatedly `\App\Models\JobSummary::count()` — the count should stay at the **previous** total until the rename completes, then jump to the new total.
3. After it finishes: `Schema::hasTable('job_summaries__staging')` should return `false`.
4. Simulate a mid-sync failure by killing the queue worker partway, then re-check the live count — it must equal the pre-sync count, and `__staging` must be dropped (or droppable by re-running).
