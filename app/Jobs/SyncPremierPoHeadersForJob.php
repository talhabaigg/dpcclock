<?php

namespace App\Jobs;

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

class SyncPremierPoHeadersForJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    private const COMPANY_ID = '3341c7c6-2abb-49e1-8a59-839d1bcff972';

    public $tries = 3;

    public $timeout = 300;

    public function __construct(
        public string $jobNumber,
        public ?int $locationId = null,
    ) {}

    public function handle(): void
    {
        Log::info('SyncPremierPoHeadersForJob: Started', ['job_number' => $this->jobNumber]);

        $authService = new PremierAuthenticationService;
        $token = $authService->getAccessToken();
        $baseUrl = config('premier.swagger_api.base_url');

        // Fetch POs filtered by job number
        $allPoIds = [];
        $page = 1;
        $pageSize = 1000;

        do {
            $response = Http::withToken($token)
                ->acceptJson()
                ->timeout(120)
                ->get("{$baseUrl}/api/PurchaseOrder/GetPurchaseOrders", [
                    'parameter.companyId' => self::COMPANY_ID,
                    'parameter.jobNumber' => $this->jobNumber,
                    'parameter.pageSize' => $pageSize,
                    'parameter.pageNumber' => $page,
                ]);

            if ($response->status() === 401) {
                $authService->clearToken();
                $token = $authService->getAccessToken();

                $response = Http::withToken($token)
                    ->acceptJson()
                    ->timeout(120)
                    ->get("{$baseUrl}/api/PurchaseOrder/GetPurchaseOrders", [
                        'parameter.companyId' => self::COMPANY_ID,
                        'parameter.jobNumber' => $this->jobNumber,
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

            foreach ($items as $item) {
                $poId = $item['PurchaseOrderId'] ?? null;
                if ($poId) {
                    $allPoIds[$poId] = true;
                }
            }

            if (count($items) < $pageSize) {
                break;
            }

            $page++;
        } while ($page <= 20);

        $allPoIds = array_keys($allPoIds);

        Log::info('SyncPremierPoHeadersForJob: Found POs', [
            'job_number' => $this->jobNumber,
            'count' => count($allPoIds),
        ]);

        $processed = 0;
        $failed = 0;

        foreach ($allPoIds as $poId) {
            try {
                $headerData = $this->fetchPoDetail($baseUrl, $token, $authService, $poId);

                if ($headerData) {
                    $this->upsertHeader($poId, $headerData);
                    $processed++;
                } else {
                    $failed++;
                }
            } catch (\Exception $e) {
                Log::warning('SyncPremierPoHeadersForJob: Failed PO detail', [
                    'po_id' => $poId,
                    'error' => $e->getMessage(),
                ]);
                $failed++;
            }

            usleep(50000);
        }

        Log::info('SyncPremierPoHeadersForJob: Completed', [
            'job_number' => $this->jobNumber,
            'processed' => $processed,
            'failed' => $failed,
        ]);
    }

    private function parseListResponse(mixed $data): array
    {
        if (! is_array($data) || empty($data)) {
            return [];
        }

        if (isset($data[0]) && is_array($data[0])) {
            if (isset($data[0][0])) {
                return $data[0];
            }
            if (isset($data[0]['PurchaseOrderId'])) {
                return $data;
            }
        }

        if (isset($data['PurchaseOrderId'])) {
            return [$data];
        }

        return [];
    }

    private function fetchPoDetail(string $baseUrl, string &$token, PremierAuthenticationService $authService, string $poId): ?array
    {
        $response = Http::withToken($token)
            ->acceptJson()
            ->timeout(30)
            ->get("{$baseUrl}/api/PurchaseOrder/GetPurchaseOrder", [
                'purchaseOrderId' => $poId,
            ]);

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

        if (is_array($data) && isset($data[0])) {
            if (is_array($data[0]) && isset($data[0][0])) {
                $data = $data[0][0];
            } elseif (isset($data[0]['PurchaseOrderId'])) {
                $data = $data[0];
            }
        }

        return is_array($data) ? $data : null;
    }

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
        Log::error('SyncPremierPoHeadersForJob: Failed permanently', [
            'job_number' => $this->jobNumber,
            'error' => $exception->getMessage(),
        ]);
    }

    public function backoff(): array
    {
        return [30, 60, 120];
    }
}
