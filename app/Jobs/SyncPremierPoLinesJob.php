<?php

namespace App\Jobs;

use App\Events\PremierSyncProgressUpdated;
use App\Models\PremierPoHeader;
use App\Models\PremierPoLine;
use App\Models\Requisition;
use App\Services\PremierPurchaseOrderService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SyncPremierPoLinesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(
        public string $premierPoId,
        public ?int $requisitionId = null
    ) {}

    public function handle(): void
    {
        $service = new PremierPurchaseOrderService;

        try {
            // Clear cache to get fresh data
            $service->clearCache($this->premierPoId);

            // If we don't have requisition_id, try to find it
            $requisitionId = $this->requisitionId;
            if (! $requisitionId) {
                $requisition = Requisition::where('premier_po_id', $this->premierPoId)->first();
                $requisitionId = $requisition?->id;
            }

            // Sync PO header first
            $header = $service->syncHeaderNow($this->premierPoId, $requisitionId);
            if ($header) {
                Log::info('SyncPremierPoLinesJob: Synced PO header', [
                    'premier_po_id' => $this->premierPoId,
                    'po_number' => $header->po_number,
                    'vendor' => $header->vendor_name,
                ]);
            }

            // Fetch lines from Premier API
            $lines = $service->fetchFromPremierApi($this->premierPoId);

            if (empty($lines)) {
                Log::info('SyncPremierPoLinesJob: No lines returned from Premier', [
                    'premier_po_id' => $this->premierPoId,
                ]);

                return;
            }

            $syncedAt = now();

            // Get existing line IDs to track what to delete
            $existingLineIds = PremierPoLine::where('premier_po_id', $this->premierPoId)
                ->pluck('premier_line_id')
                ->toArray();

            $updatedLineIds = [];

            foreach ($lines as $line) {
                $lineId = $line['PurchaseOrderLineId'] ?? null;
                if (! $lineId) {
                    continue;
                }

                $updatedLineIds[] = $lineId;

                PremierPoLine::updateOrCreate(
                    ['premier_line_id' => $lineId],
                    [
                        'premier_po_id' => $this->premierPoId,
                        'requisition_id' => $requisitionId,
                        'line_number' => $line['Line'] ?? 0,
                        'description' => $line['LineDescription'] ?? '',
                        'quantity' => (float) ($line['Quantity'] ?? 0),
                        'unit_cost' => (float) ($line['UnitCost'] ?? 0),
                        'amount' => (float) ($line['Amount'] ?? 0),
                        'invoice_balance' => (float) ($line['InvoiceBalance'] ?? 0),
                        'cost_item_id' => $line['CostItemId'] ?? null,
                        'cost_type_id' => $line['CostTypeId'] ?? null,
                        'job_id' => $line['JobId'] ?? null,
                        'item_id' => $line['ItemId'] ?? null,
                        'synced_at' => $syncedAt,
                    ]
                );
            }

            // Delete lines that no longer exist in Premier
            $deletedLineIds = array_diff($existingLineIds, $updatedLineIds);
            if (! empty($deletedLineIds)) {
                PremierPoLine::whereIn('premier_line_id', $deletedLineIds)->delete();

                Log::info('SyncPremierPoLinesJob: Deleted stale lines', [
                    'premier_po_id' => $this->premierPoId,
                    'deleted_count' => count($deletedLineIds),
                ]);
            }

            Log::info('SyncPremierPoLinesJob: Successfully synced PO lines', [
                'premier_po_id' => $this->premierPoId,
                'requisition_id' => $requisitionId,
                'lines_count' => count($lines),
            ]);

            // Broadcast progress update
            $this->broadcastProgress($header?->po_number);

        } catch (\Exception $e) {
            Log::error('SyncPremierPoLinesJob: Failed to sync PO lines', [
                'premier_po_id' => $this->premierPoId,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Broadcast sync progress to connected clients
     */
    protected function broadcastProgress(?string $poNumber = null): void
    {
        try {
            // Get sync context (filtered PO IDs) from cache
            $syncContext = Cache::get('premier_sync_context');

            if ($syncContext && ! empty($syncContext['po_ids'])) {
                // Use filtered PO IDs from sync context
                $poIdsToSync = $syncContext['po_ids'];
                $total = count($poIdsToSync);

                // Count how many of those have been cached
                $cachedPoIds = PremierPoLine::select('premier_po_id')
                    ->distinct()
                    ->whereIn('premier_po_id', $poIdsToSync)
                    ->pluck('premier_po_id')
                    ->toArray();

                $cached = count($cachedPoIds);
                $missing = $total - $cached;
            } else {
                // Fallback to counting all requisitions if no context
                $total = Requisition::whereNotNull('premier_po_id')
                    ->whereNotNull('po_number')
                    ->count();

                $cachedPoIds = PremierPoLine::select('premier_po_id')
                    ->distinct()
                    ->pluck('premier_po_id')
                    ->toArray();

                $cached = Requisition::whereNotNull('premier_po_id')
                    ->whereNotNull('po_number')
                    ->whereIn('premier_po_id', $cachedPoIds)
                    ->count();

                $missing = $total - $cached;
            }

            // Check if queue is empty (this was the last job)
            $pendingJobs = DB::table('jobs')
                ->where('payload', 'like', '%SyncPremierPoLinesJob%')
                ->count();

            $status = $pendingJobs > 0 ? 'syncing' : 'completed';

            // Clear sync context when completed
            if ($status === 'completed') {
                Cache::forget('premier_sync_context');
            }

            event(new PremierSyncProgressUpdated(
                cached: $cached,
                total: $total,
                missing: $missing,
                stale: 0,
                lastSyncedPo: $poNumber,
                status: $status
            ));
        } catch (\Exception $e) {
            Log::warning('Failed to broadcast sync progress', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Dispatch sync jobs for multiple requisitions
     */
    public static function dispatchForRequisitions(array $requisitionIds): int
    {
        $requisitions = Requisition::whereIn('id', $requisitionIds)
            ->whereNotNull('premier_po_id')
            ->get();

        $count = 0;
        foreach ($requisitions as $requisition) {
            static::dispatch($requisition->premier_po_id, $requisition->id);
            $count++;
        }

        return $count;
    }

    /**
     * Dispatch sync jobs for all Premier PO IDs (from requisitions, cached lines, AND cached headers)
     */
    public static function dispatchForAll(): int
    {
        // Get PO IDs from requisitions
        $requisitionPoIds = Requisition::whereNotNull('premier_po_id')
            ->whereNotNull('po_number')
            ->pluck('premier_po_id', 'id')
            ->toArray();

        // Get unique PO IDs from cached lines
        $cachedLinePoIds = PremierPoLine::select('premier_po_id')
            ->distinct()
            ->pluck('premier_po_id')
            ->toArray();

        // Get unique PO IDs from cached headers
        $cachedHeaderPoIds = PremierPoHeader::select('premier_po_id')
            ->distinct()
            ->pluck('premier_po_id')
            ->toArray();

        // Merge all unique PO IDs
        $allPoIds = array_unique(array_merge(
            array_values($requisitionPoIds),
            $cachedLinePoIds,
            $cachedHeaderPoIds
        ));

        // Create a reverse lookup: po_id -> requisition_id
        $poToRequisition = array_flip($requisitionPoIds);

        $count = 0;
        foreach ($allPoIds as $poId) {
            $requisitionId = $poToRequisition[$poId] ?? null;
            static::dispatch($poId, $requisitionId);
            $count++;
        }

        return $count;
    }

    /**
     * Dispatch sync jobs for all stale Premier PO data (from requisitions, cached lines, AND cached headers)
     */
    public static function dispatchForStale(int $staleMinutes = 60): int
    {
        // Get PO IDs from requisitions
        $requisitionPoIds = Requisition::whereNotNull('premier_po_id')
            ->whereNotNull('po_number')
            ->pluck('premier_po_id', 'id')
            ->toArray();

        // Get unique PO IDs from cached lines
        $cachedLinePoIds = PremierPoLine::select('premier_po_id')
            ->distinct()
            ->pluck('premier_po_id')
            ->toArray();

        // Get unique PO IDs from cached headers
        $cachedHeaderPoIds = PremierPoHeader::select('premier_po_id')
            ->distinct()
            ->pluck('premier_po_id')
            ->toArray();

        // Merge all unique PO IDs
        $allPoIds = array_unique(array_merge(
            array_values($requisitionPoIds),
            $cachedLinePoIds,
            $cachedHeaderPoIds
        ));

        // Create a reverse lookup: po_id -> requisition_id
        $poToRequisition = array_flip($requisitionPoIds);

        $count = 0;
        foreach ($allPoIds as $poId) {
            // Check if either lines or header is stale
            $linesStale = PremierPoLine::isStale($poId, $staleMinutes);
            $headerStale = PremierPoHeader::isStale($poId, $staleMinutes);

            if ($linesStale || $headerStale) {
                $requisitionId = $poToRequisition[$poId] ?? null;
                static::dispatch($poId, $requisitionId);
                $count++;
            }
        }

        return $count;
    }
}
