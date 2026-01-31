<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PremierPurchaseOrderService
{
    protected PremierAuthenticationService $authService;
    protected string $baseUrl;

    public function __construct()
    {
        $this->authService = new PremierAuthenticationService();
        $this->baseUrl = env('PREMIER_SWAGGER_API_URL');
    }

    /**
     * Get PO lines from Premier API for a specific Purchase Order
     * Caches results for 5 minutes
     */
    public function getPurchaseOrderLines(string $premierPoId): array
    {
        $cacheKey = "premier_po_lines_{$premierPoId}";

        return Cache::remember($cacheKey, now()->addMinutes(5), function () use ($premierPoId) {
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
                throw new \Exception('Failed to fetch Purchase Order lines from Premier: ' . $response->body());
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
            if (!is_array($data) || empty($data)) {
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
        });
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

}
