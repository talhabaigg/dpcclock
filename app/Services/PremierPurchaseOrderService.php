<?php

namespace App\Services;

use App\Jobs\SyncPremierPoLinesJob;
use App\Models\PremierPoHeader;
use App\Models\PremierPoLine;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PremierPurchaseOrderService
{
    protected PremierAuthenticationService $authService;

    protected string $baseUrl;

    public function __construct()
    {
        $this->authService = new PremierAuthenticationService;
        $this->baseUrl = env('PREMIER_SWAGGER_API_URL');
    }

    /**
     * Get PO lines - uses local database first, falls back to API
     * Returns data in Premier API format for compatibility
     *
     * @param  bool  $forceRefresh  Force fetch from API even if cached
     * @param  bool  $cacheOnly  Only return cached data, don't fall back to API
     */
    public function getPurchaseOrderLines(string $premierPoId, bool $forceRefresh = false, bool $cacheOnly = false): array
    {
        // Try to get from local database first (unless forced refresh)
        if (! $forceRefresh) {
            $localLines = $this->getFromLocalDatabase($premierPoId);
            if (! empty($localLines)) {
                return $localLines;
            }
        }

        // If cache only mode, don't fall back to API
        if ($cacheOnly) {
            return [];
        }

        // Fall back to API
        return $this->fetchFromPremierApi($premierPoId);
    }

    /**
     * Get lines from local database, converted to Premier API format
     */
    protected function getFromLocalDatabase(string $premierPoId): array
    {
        $lines = PremierPoLine::getByPremierPoId($premierPoId);

        if ($lines->isEmpty()) {
            return [];
        }

        // Convert to Premier API format for compatibility
        return $lines->map(function (PremierPoLine $line) {
            return [
                'PurchaseOrderLineId' => $line->premier_line_id,
                'PurchaseOrderId' => $line->premier_po_id,
                'Line' => $line->line_number,
                'LineDescription' => $line->description,
                'Quantity' => (float) $line->quantity,
                'UnitCost' => (float) $line->unit_cost,
                'Amount' => (float) $line->amount,
                'InvoiceBalance' => (float) $line->invoice_balance,
                'CostItemId' => $line->cost_item_id,
                'CostTypeId' => $line->cost_type_id,
                'JobId' => $line->job_id,
                'ItemId' => $line->item_id,
            ];
        })->toArray();
    }

    /**
     * Queue a sync job for the given PO
     */
    public function queueSync(string $premierPoId, ?int $requisitionId = null): void
    {
        SyncPremierPoLinesJob::dispatch($premierPoId, $requisitionId);
    }

    /**
     * Sync PO lines immediately (for when you need the data now)
     */
    public function syncNow(string $premierPoId, ?int $requisitionId = null): array
    {
        $lines = $this->fetchFromPremierApi($premierPoId);

        if (! empty($lines)) {
            // Store in database
            $this->storeLines($premierPoId, $lines, $requisitionId);
        }

        return $lines;
    }

    /**
     * Store lines in the local database
     */
    protected function storeLines(string $premierPoId, array $lines, ?int $requisitionId): void
    {
        $syncedAt = now();

        foreach ($lines as $line) {
            $lineId = $line['PurchaseOrderLineId'] ?? null;
            if (! $lineId) {
                continue;
            }

            PremierPoLine::updateOrCreate(
                ['premier_line_id' => $lineId],
                [
                    'premier_po_id' => $premierPoId,
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
    }

    /**
     * Fetch PO lines directly from Premier API
     * Used when local data is not available or refresh is forced
     */
    public function fetchFromPremierApi(string $premierPoId): array
    {
        try {
            $token = $this->authService->getAccessToken();

            $response = Http::withToken($token)
                ->acceptJson()
                ->get("{$this->baseUrl}/api/PurchaseOrder/GetPurchaseOrderLines", [
                    'purchaseOrderId' => $premierPoId,
                    'pageSize' => 1000, // Default might be 1, so request more
                ]);

            if ($response->failed()) {
                Log::error('Failed to fetch Premier PO lines', [
                    'premier_po_id' => $premierPoId,
                    'status' => $response->status(),
                    'response' => $response->body(),
                ]);
                throw new \Exception('Failed to fetch Purchase Order lines from Premier: '.$response->body());
            }

            // Response structure: Data contains array of arrays
            $data = $response->json('Data');

            // Log raw response for debugging
            $firstItem = null;
            $firstItemKeys = null;
            if (is_array($data) && isset($data[0])) {
                if (is_array($data[0]) && isset($data[0][0])) {
                    // Nested: Data = [[item1, item2]]
                    $firstItem = $data[0][0];
                    $firstItemKeys = is_array($firstItem) ? array_keys($firstItem) : 'not-array';
                } elseif (is_array($data[0])) {
                    // Check if data[0] is the item itself or an array of items
                    $firstItemKeys = array_keys($data[0]);
                    // If keys are numeric, it's an array of items
                    if (isset($firstItemKeys[0]) && is_int($firstItemKeys[0])) {
                        $firstItem = $data[0][0] ?? null;
                    } else {
                        // Keys are strings, so data[0] IS the item
                        $firstItem = $data[0];
                    }
                }
            }

            Log::info('Premier GetPurchaseOrderLines raw response', [
                'premier_po_id' => $premierPoId,
                'item_count' => is_array($data) && isset($data[0]) && is_array($data[0])
                    ? (isset($data[0][0]) ? count($data[0]) : 1)
                    : 0,
                'first_item_keys' => $firstItemKeys,
                'first_item_sample' => $firstItem ? array_slice($firstItem, 0, 5) : null,
            ]);

            // Handle different response structures
            if (! is_array($data) || empty($data)) {
                return [];
            }

            // Check if Data is [[item1, item2]] (nested) or [item1, item2] (flat)
            $firstElement = $data[0] ?? null;

            if (is_array($firstElement)) {
                // Check if firstElement is an item (has PurchaseOrderLineId) or an array of items
                if (isset($firstElement['PurchaseOrderLineId'])) {
                    // Data = [item1, item2, ...] - flat array of items
                    return $data;
                } else {
                    // Data = [[item1, item2, ...]] - nested array
                    return $firstElement;
                }
            }

            return $data;
        } catch (\Exception $e) {
            Log::error('fetchFromPremierApi failed', [
                'premier_po_id' => $premierPoId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Get deleted line IDs for a PO
     */
    public function getDeletedPurchaseOrderLineIds(string $premierPoId): array
    {
        $token = $this->authService->getAccessToken();

        $response = Http::withToken($token)
            ->acceptJson()
            ->get("{$this->baseUrl}/api/PurchaseOrder/GetDeletedPurchaseOrderLineIds", [
                'purchaseOrderId' => $premierPoId,
            ]);

        if ($response->failed()) {
            Log::warning('Failed to fetch deleted PO line IDs', [
                'premier_po_id' => $premierPoId,
                'response' => $response->body(),
            ]);

            return [];
        }

        return $response->json('Data') ?? [];
    }

    /**
     * Get invoice lines for a PO by fetching lines from invoices linked to this PO
     * Returns array of individual invoice lines for comparison
     */
    public function getInvoiceLinesByPoNumber(string $poNumber): array
    {
        if (empty($poNumber)) {
            return [];
        }

        // Get all invoice unique IDs for this PO
        $invoiceIds = \App\Models\ApPostedInvoice::query()
            ->where('po_number', $poNumber)
            ->pluck('unique_id')
            ->toArray();

        if (empty($invoiceIds)) {
            return [];
        }

        // Get all invoice lines for these invoices
        $lines = \App\Models\ApPostedInvoiceLine::query()
            ->whereIn('invoice_unique_id', $invoiceIds)
            ->get();

        if ($lines->isEmpty()) {
            return [];
        }

        // Return individual lines (not grouped)
        return $lines->map(function ($line) {
            return [
                'line_description' => $line->line_description,
                'qty' => (float) $line->quantity,
                'unit_cost' => (float) $line->unit_cost,
                'total_cost' => (float) $line->amount,
                'invoice_number' => $line->invoice_number,
                'invoice_unique_id' => $line->invoice_unique_id,
            ];
        })->values()->toArray();
    }

    /**
     * Clear cached PO lines (for manual refresh)
     */
    public function clearCache(string $premierPoId): void
    {
        Cache::forget("premier_po_lines_{$premierPoId}");
    }

    /**
     * Get invoices for a PO by PO number from local synced data
     * Returns array of invoices associated with this PO
     */
    public function getInvoicesByPoNumber(string $poNumber): array
    {
        if (empty($poNumber)) {
            return [];
        }

        // Query ap_posted_invoices directly by po_number
        $invoices = \App\Models\ApPostedInvoice::query()
            ->where('po_number', $poNumber)
            ->get();

        if ($invoices->isEmpty()) {
            return [];
        }

        return $invoices->map(function ($invoice) {
            return [
                'InvoiceId' => $invoice->unique_id,
                'InvoiceNumber' => $invoice->invoice_number,
                'InvoiceDate' => $invoice->invoice_date?->toIso8601String(),
                'InvoiceTotal' => (float) $invoice->invoice_total,
                'InvoiceStatus' => $invoice->invoice_status,
                'ApprovalStatus' => $invoice->approval_status,
                'VendorCode' => $invoice->vendor_code,
                'VendorName' => $invoice->vendor,
                'JobNumber' => $invoice->job_number,
                'PONumber' => $invoice->po_number,
            ];
        })->toArray();
    }

    /**
     * Get PO header - uses local database first, falls back to API
     */
    public function getPurchaseOrderHeader(string $premierPoId, bool $forceRefresh = false): ?array
    {
        // Try to get from local database first (unless forced refresh)
        if (! $forceRefresh) {
            $localHeader = PremierPoHeader::getByPremierPoId($premierPoId);
            if ($localHeader) {
                return $this->headerToArray($localHeader);
            }
        }

        // Fall back to API
        return $this->fetchHeaderFromPremierApi($premierPoId);
    }

    /**
     * Convert local header model to array format matching Premier API
     */
    protected function headerToArray(PremierPoHeader $header): array
    {
        return [
            'PurchaseOrderId' => $header->premier_po_id,
            'PONumber' => $header->po_number,
            'VendorId' => $header->vendor_id,
            'VendorCode' => $header->vendor_code,
            'VendorName' => $header->vendor_name,
            'JobId' => $header->job_id,
            'JobNumber' => $header->job_number,
            'PODate' => $header->po_date?->toIso8601String(),
            'RequiredDate' => $header->required_date?->toIso8601String(),
            'Total' => (float) $header->total_amount,
            'InvoicedAmount' => (float) $header->invoiced_amount,
            'Status' => $header->status,
            'ApprovalStatus' => $header->approval_status,
            'Description' => $header->description,
        ];
    }

    /**
     * Fetch PO header directly from Premier API
     */
    public function fetchHeaderFromPremierApi(string $premierPoId): ?array
    {
        try {
            $token = $this->authService->getAccessToken();

            $response = Http::withToken($token)
                ->acceptJson()
                ->get("{$this->baseUrl}/api/PurchaseOrder/GetPurchaseOrder", [
                    'purchaseOrderId' => $premierPoId,
                ]);

            if ($response->failed()) {
                Log::warning('Failed to fetch Premier PO header', [
                    'premier_po_id' => $premierPoId,
                    'status' => $response->status(),
                    'response' => $response->body(),
                ]);

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

            return $data;
        } catch (\Exception $e) {
            Log::error('fetchHeaderFromPremierApi failed', [
                'premier_po_id' => $premierPoId,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Store PO header in the local database
     */
    public function storeHeader(string $premierPoId, array $headerData, ?int $requisitionId = null): PremierPoHeader
    {
        $syncedAt = now();

        return PremierPoHeader::updateOrCreate(
            ['premier_po_id' => $premierPoId],
            [
                'requisition_id' => $requisitionId,
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
                'synced_at' => $syncedAt,
            ]
        );
    }

    /**
     * Sync PO header immediately
     */
    public function syncHeaderNow(string $premierPoId, ?int $requisitionId = null): ?PremierPoHeader
    {
        $headerData = $this->fetchHeaderFromPremierApi($premierPoId);

        if ($headerData) {
            return $this->storeHeader($premierPoId, $headerData, $requisitionId);
        }

        return null;
    }
}
