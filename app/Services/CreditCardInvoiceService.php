<?php

namespace App\Services;

use App\Models\CreditCardReceipt;
use App\Models\PremierGlAccount;
use App\Models\PremierVendor;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class CreditCardInvoiceService
{
    public function generateInvoicePayload(CreditCardReceipt $receipt, PremierVendor $vendor, PremierGlAccount $glAccount): array
    {
        $invoiceDate = $receipt->transaction_date
            ? Carbon::parse($receipt->transaction_date)->format('Y-m-d')
            : now()->format('Y-m-d');

        $netAmount = (float) $receipt->total_amount - (float) ($receipt->gst_amount ?? 0);

        return [
            'SubledgerId' => $vendor->ap_subledger_id,
            'TransactionDate' => now()->toIso8601String(),
            'APInvoices' => [
                [
                    'VendorId' => $vendor->premier_vendor_id,
                    'InvoiceNumber' => $this->buildInvoiceNumber($receipt),
                    'InvoiceDate' => $invoiceDate,
                    'ReceivedDate' => now()->format('Y-m-d'),
                    'Memo' => $this->buildMemo($receipt),
                    'AutoTax' => false,
                    'HoldbackPercent' => 0,
                    'Holdback' => 0,
                    'DiscountPercent' => 0,
                    'Discount' => 0,
                    'ConditionalDiscount' => 0,
                    'Freight' => 0,
                    'APInvoiceLines' => [
                        [
                            'Line' => 1,
                            'LineDescription' => $this->buildLineDescription($receipt),
                            'Quantity' => 1,
                            'UnitCost' => $netAmount,
                            'Amount' => $netAmount,
                            'CompanyId' => $this->getCompanyId(),
                            'AccountId' => $glAccount->premier_account_id,
                            'DivisionId' => config('premier.headoffice_division_id'),
                            'TaxGroup' => 'GST',
                            'Tax1' => (float) ($receipt->gst_amount ?? 0),
                            'Tax2' => 0,
                        ],
                    ],
                ],
            ],
        ];
    }

    public function sendInvoiceToPremier(CreditCardReceipt $receipt, array $payload): array
    {
        $authService = new PremierAuthenticationService;
        $token = $authService->getAccessToken();
        $baseUrl = config('premier.swagger_api.base_url');

        Log::info("Sending CC receipt #{$receipt->id} to Premier as AP Invoice", $payload);

        try {
            $response = Http::withToken($token)
                ->acceptJson()
                ->timeout(60)
                ->post("{$baseUrl}/api/APInvoice/CreateAPInvoice", $payload);
        } catch (\Exception $e) {
            Log::error("Premier API exception for CC Receipt #{$receipt->id}", [
                'error' => $e->getMessage(),
            ]);

            return ['success' => false, 'message' => 'Premier API request timed out or failed to connect.'];
        }

        Log::info("Premier AP Invoice Response for CC Receipt #{$receipt->id}", [
            'status' => $response->status(),
            'body' => $response->body(),
        ]);

        $invoiceId = $response->json('Data.0.APInvoices.0.InvoiceId') ?? null;
        $batchId = $response->json('Data.0.APInvoiceBatchId') ?? null;

        if ($invoiceId) {
            // Attach receipt document to the invoice
            $this->attachDocumentToInvoice($receipt, $invoiceId, $token, $baseUrl);

            // Auto-post the batch
            if ($batchId) {
                $this->postInvoiceBatch($receipt, $batchId, $token, $baseUrl);
            }

            return ['success' => true, 'invoice_id' => $invoiceId];
        }

        if ($response->failed()) {
            return ['success' => false, 'message' => "HTTP {$response->status()}: {$response->body()}"];
        }

        // 2xx but no invoice ID
        return ['success' => true, 'invoice_id' => null, 'message' => 'Invoice created but no ID returned.'];
    }

    private function buildInvoiceNumber(CreditCardReceipt $receipt): string
    {
        $merchant = $receipt->merchant_name ?? 'UNKNO';
        // Strip non-alpha, uppercase, take first 5 chars, pad to 5 if shorter
        $vendor = strtoupper(preg_replace('/[^a-zA-Z]/', '', $merchant));
        $vendor = str_pad(substr($vendor, 0, 5), 5, 'X');

        return 'CC' . $vendor . str_pad($receipt->id, 4, '0', STR_PAD_LEFT);
    }

    private function buildMemo(CreditCardReceipt $receipt): string
    {
        $parts = array_filter([
            $receipt->merchant_name,
            $receipt->card_last_four ? "Card ****{$receipt->card_last_four}" : null,
            $receipt->user?->name,
        ]);

        return implode(' | ', $parts) ?: "CC Receipt #{$receipt->id}";
    }

    private function buildLineDescription(CreditCardReceipt $receipt): string
    {
        $parts = array_filter([
            $receipt->merchant_name,
            $receipt->description,
            $receipt->category ? ucfirst($receipt->category) : null,
        ]);

        return implode(' - ', $parts) ?: "Credit Card Receipt #{$receipt->id}";
    }

    private function postInvoiceBatch(CreditCardReceipt $receipt, string $batchId, string $token, string $baseUrl): void
    {
        try {
            $response = Http::withToken($token)
                ->acceptJson()
                ->timeout(60)
                ->put("{$baseUrl}/api/APInvoice/PostAPInvoiceBatch", [
                    'APInvoiceBatchId' => $batchId,
                ]);

            if ($response->successful()) {
                Log::info("AP Invoice batch posted for CC Receipt #{$receipt->id}", [
                    'batch_id' => $batchId,
                ]);
            } else {
                Log::warning("Failed to post AP Invoice batch for CC Receipt #{$receipt->id}", [
                    'batch_id' => $batchId,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning("Post AP Invoice batch failed for CC Receipt #{$receipt->id}", [
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function attachDocumentToInvoice(CreditCardReceipt $receipt, string $invoiceId, string $token, string $baseUrl): void
    {
        $media = $receipt->getFirstMedia('receipts');

        if (! $media) {
            Log::warning("No media to attach for CC Receipt #{$receipt->id}");

            return;
        }

        try {
            $contents = $media->disk === 's3'
                ? Storage::disk('s3')->get($media->getPathRelativeToRoot())
                : file_get_contents($media->getPath());

            $fileName = $media->file_name;
            $mimeType = $media->mime_type;

            $response = Http::withToken($token)
                ->acceptJson()
                ->timeout(60)
                ->attach('File', $contents, $fileName, ['Content-Type' => $mimeType])
                ->put("{$baseUrl}/api/APInvoice/AddDocumentToAPInvoice", [
                    'APInvoiceId' => $invoiceId,
                    'DocumentName' => $fileName,
                ]);

            if ($response->successful()) {
                Log::info("Document attached to AP Invoice for CC Receipt #{$receipt->id}", [
                    'invoice_id' => $invoiceId,
                    'document_id' => $response->json('Data.0.DocumentId'),
                ]);
            } else {
                Log::warning("Failed to attach document for CC Receipt #{$receipt->id}", [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning("Document attachment failed for CC Receipt #{$receipt->id}", [
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function getCompanyId(): string
    {
        // SWCP company UUID in Premier
        return config('premier.swcp_company_id', '3341c7c6-2abb-49e1-8a59-839d1bcff972');
    }
}
