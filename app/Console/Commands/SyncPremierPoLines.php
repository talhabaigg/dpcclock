<?php

namespace App\Console\Commands;

use App\Jobs\SyncPremierPoLinesJob;
use Illuminate\Console\Command;

class SyncPremierPoLines extends Command
{
    protected $signature = 'premier:sync-po-lines
                            {--all : Sync all requisitions with Premier PO IDs}
                            {--stale= : Only sync data older than X minutes (default: 60)}
                            {--requisition= : Sync a specific requisition ID}
                            {--po= : Sync a specific Premier PO ID}';

    protected $description = 'Sync PO line data from Premier API to local database';

    public function handle(): int
    {
        if ($this->option('requisition')) {
            return $this->syncSingleRequisition((int) $this->option('requisition'));
        }

        if ($this->option('po')) {
            return $this->syncSinglePo($this->option('po'));
        }

        if ($this->option('all')) {
            return $this->syncAll();
        }

        // Default: sync stale data
        $staleMinutes = (int) ($this->option('stale') ?: 60);

        return $this->syncStale($staleMinutes);
    }

    protected function syncSingleRequisition(int $requisitionId): int
    {
        $requisition = \App\Models\Requisition::find($requisitionId);

        if (! $requisition) {
            $this->error("Requisition {$requisitionId} not found");

            return 1;
        }

        if (! $requisition->premier_po_id) {
            $this->error("Requisition {$requisitionId} has no Premier PO ID");

            return 1;
        }

        SyncPremierPoLinesJob::dispatch($requisition->premier_po_id, $requisition->id);
        $this->info("Queued sync for requisition {$requisitionId} (PO: {$requisition->premier_po_id})");

        return 0;
    }

    protected function syncSinglePo(string $premierPoId): int
    {
        SyncPremierPoLinesJob::dispatch($premierPoId);
        $this->info("Queued sync for Premier PO: {$premierPoId}");

        return 0;
    }

    protected function syncAll(): int
    {
        $this->info('Queueing sync jobs for all requisitions with Premier PO IDs...');

        $count = SyncPremierPoLinesJob::dispatchForAll();

        $this->info("Queued {$count} sync jobs");

        return 0;
    }

    protected function syncStale(int $staleMinutes): int
    {
        $this->info("Queueing sync jobs for data older than {$staleMinutes} minutes...");

        $count = SyncPremierPoLinesJob::dispatchForStale($staleMinutes);

        $this->info("Queued {$count} sync jobs");

        return 0;
    }
}
