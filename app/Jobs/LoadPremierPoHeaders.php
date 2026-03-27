<?php

namespace App\Jobs;

use App\Models\DataSyncLog;
use App\Models\PremierPoHeader;
use App\Services\PremierAuthenticationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class LoadPremierPoHeaders implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    private const JOB_NAME = 'premier_po_headers';

    private const COMPANY_ID = '3341c7c6-2abb-49e1-8a59-839d1bcff972';

    public $tries;

    public $timeout;

    public function __construct()
    {
        $this->tries = config('premier.jobs.retry_times', 3);
        $this->timeout = config('premier.jobs.timeout', 600);
    }

    public function handle(): void
    {
        $startTime = now();
        Log::info('LoadPremierPoHeaders: Job started');

        try {
            $authService = new PremierAuthenticationService;
            $token = $authService->getAccessToken();
            $baseUrl = config('premier.swagger_api.base_url');

            // Phase 1: Paginate through GetPurchaseOrders to collect all PO IDs
            $allPoIds = [];
            $seenPoIds = [];
            $page = 1;
            $pageSize = 1000;
            $maxPages = 50;

            do {
                Log::info('LoadPremierPoHeaders: Fetching PO list page', ['page' => $page]);

                $response = Http::withToken($token)
                    ->acceptJson()
                    ->timeout(120)
                    ->get("{$baseUrl}/api/PurchaseOrder/GetPurchaseOrders", [
                        'parameter.companyId' => self::COMPANY_ID,
                        'parameter.pageSize' => $pageSize,
                        'parameter.pageNumber' => $page,
                    ]);

                // Handle 401 by refreshing token
                if ($response->status() === 401) {
                    Log::warning('LoadPremierPoHeaders: 401 on list, refreshing token');
                    $authService->clearToken();
                    $token = $authService->getAccessToken();

                    $response = Http::withToken($token)
                        ->acceptJson()
                        ->timeout(120)
                        ->get("{$baseUrl}/api/PurchaseOrder/GetPurchaseOrders", [
                            'parameter.companyId' => self::COMPANY_ID,
                            'parameter.pageSize' => $pageSize,
                            'parameter.pageNumber' => $page,
                        ]);
                }

                if ($response->failed()) {
                    throw new \RuntimeException(
                        "GetPurchaseOrders failed with status {$response->status()}: {$response->body()}"
                    );
                }

                $items = $this->parseListResponse($response->json('Data'));

                if (empty($items)) {
                    break;
                }

                $newItems = 0;
                foreach ($items as $item) {
                    $poId = $item['PurchaseOrderId'] ?? null;
                    if ($poId && ! isset($seenPoIds[$poId])) {
                        $seenPoIds[$poId] = true;
                        $allPoIds[] = $poId;
                        $newItems++;
                    }
                }

                Log::info("LoadPremierPoHeaders: Page {$page}", [
                    'items' => count($items),
                    'new' => $newItems,
                    'total_unique' => count($allPoIds),
                ]);

                if ($newItems === 0 || count($items) < $pageSize || $page >= $maxPages) {
                    break;
                }

                $page++;
            } while (true);

            if (empty($allPoIds)) {
                Log::warning('LoadPremierPoHeaders: No POs found, skipping');

                return;
            }

            // Phase 2: Filter to only stale POs (not synced in the last 24 hours)
            $staleThresholdHours = 24;
            $freshPoIds = PremierPoHeader::whereIn('premier_po_id', $allPoIds)
                ->where('synced_at', '>=', now()->subHours($staleThresholdHours))
                ->whereNotNull('required_date') // Only skip if we already have the key field
                ->pluck('premier_po_id')
                ->toArray();

            $stalePoIds = array_values(array_diff($allPoIds, $freshPoIds));

            Log::info('LoadPremierPoHeaders: Fetching details for stale POs', [
                'total' => count($allPoIds),
                'stale' => count($stalePoIds),
                'skipped_fresh' => count($freshPoIds),
            ]);

            // Phase 3: Fetch full details for stale POs only
            $processed = 0;
            $failed = 0;

            foreach ($stalePoIds as $poId) {
                try {
                    $headerData = $this->fetchPoDetail($baseUrl, $token, $authService, $poId);

                    if ($headerData) {
                        $this->upsertHeader($poId, $headerData);
                        $processed++;
                    } else {
                        $failed++;
                    }
                } catch (\Exception $e) {
                    Log::warning('LoadPremierPoHeaders: Failed to fetch PO detail', [
                        'po_id' => $poId,
                        'error' => $e->getMessage(),
                    ]);
                    $failed++;
                }

                if (($processed + $failed) % 100 === 0) {
                    Log::info('LoadPremierPoHeaders: Progress', [
                        'processed' => $processed,
                        'failed' => $failed,
                        'remaining' => count($stalePoIds) - $processed - $failed,
                    ]);
                }

                // Small delay to avoid overwhelming the API
                usleep(50000); // 50ms
            }

            DataSyncLog::updateOrCreate(
                ['job_name' => self::JOB_NAME],
                ['last_successful_sync' => now(), 'records_synced' => count($allPoIds)]
            );

            $duration = now()->diffInSeconds($startTime);
            Log::info('LoadPremierPoHeaders: Job completed', [
                'total_pos' => count($allPoIds),
                'refreshed' => $processed,
                'skipped_fresh' => count($freshPoIds),
                'failed' => $failed,
                'duration_seconds' => $duration,
            ]);

        } catch (Throwable $e) {
            Log::error('LoadPremierPoHeaders: Job failed', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            throw $e;
        }
    }

    /**
     * Parse the nested response structure from GetPurchaseOrders.
     */
    private function parseListResponse(mixed $data): array
    {
        if (! is_array($data) || empty($data)) {
            return [];
        }

        if (isset($data[0]) && is_array($data[0])) {
            if (isset($data[0][0])) {
                return $data[0]; // Nested: [[item1, item2]]
            }
            if (isset($data[0]['PurchaseOrderId'])) {
                return $data; // Flat: [item1, item2]
            }
        }

        if (isset($data['PurchaseOrderId'])) {
            return [$data]; // Single item
        }

        return [];
    }

    /**
     * Fetch full PO detail from GetPurchaseOrder endpoint.
     */
    private function fetchPoDetail(string $baseUrl, string &$token, PremierAuthenticationService $authService, string $poId): ?array
    {
        $response = Http::withToken($token)
            ->acceptJson()
            ->timeout(30)
            ->get("{$baseUrl}/api/PurchaseOrder/GetPurchaseOrder", [
                'purchaseOrderId' => $poId,
            ]);

        // Handle 401 by refreshing token
        if ($response->status() === 401) {
            $authService->clearToken();
            $token = $authService->getAccessToken();

            $response = Http::withToken($token)
                ->acceptJson()
                ->timeout(30)
                ->get("{$baseUrl}/api/PurchaseOrder/GetPurchaseOrder", [
                    'purchaseOrderId' => $poId,
                ]);
        }

        if ($response->failed()) {
            return null;
        }

        $data = $response->json('Data');

        // Handle nested response structure
        if (is_array($data) && isset($data[0])) {
            if (is_array($data[0]) && isset($data[0][0])) {
                $data = $data[0][0];
            } elseif (isset($data[0]['PurchaseOrderId'])) {
                $data = $data[0];
            }
        }

        return is_array($data) ? $data : null;
    }

    /**
     * Upsert a PO header, preserving existing requisition_id.
     */
    private function upsertHeader(string $poId, array $headerData): void
    {
        $updateData = [
            'po_number' => $headerData['PONumber'] ?? null,
            'vendor_id' => $headerData['VendorId'] ?? null,
            'vendor_code' => $headerData['VendorCode'] ?? null,
            'vendor_name' => $headerData['VendorName'] ?? null,
            'job_id' => $headerData['JobId'] ?? null,
            'job_number' => $headerData['JobNumber'] ?? null,
            'po_date' => isset($headerData['PODate']) ? \Carbon\Carbon::parse($headerData['PODate']) : null,
            'required_date' => isset($headerData['RequiredDate']) ? \Carbon\Carbon::parse($headerData['RequiredDate']) : null,
            'total_amount' => (float) ($headerData['Total'] ?? $headerData['Amount'] ?? 0),
            'invoiced_amount' => (float) ($headerData['InvoicedAmount'] ?? $headerData['InvoiceBalance'] ?? 0),
            'status' => $headerData['Status'] ?? $headerData['POStatus'] ?? null,
            'approval_status' => $headerData['ApprovalStatus'] ?? null,
            'description' => $headerData['Description'] ?? null,
            'raw_data' => $headerData,
            'synced_at' => now(),
        ];

        // Preserve existing requisition_id — don't overwrite with null
        $existing = PremierPoHeader::where('premier_po_id', $poId)->first();
        if (! $existing || ! $existing->requisition_id) {
            $updateData['requisition_id'] = null;
        }

        PremierPoHeader::updateOrCreate(
            ['premier_po_id' => $poId],
            $updateData
        );
    }

    public function failed(Throwable $exception): void
    {
        Log::error('LoadPremierPoHeaders: Job failed permanently after all retries', [
            'error' => $exception->getMessage(),
            'attempts' => $this->attempts(),
        ]);
    }

    public function backoff(): array
    {
        return [60, 120, 240];
    }
}
