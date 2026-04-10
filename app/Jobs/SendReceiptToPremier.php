<?php

namespace App\Jobs;

use App\Models\CreditCardReceipt;
use App\Models\PremierGlAccount;
use App\Models\PremierVendor;
use App\Services\CreditCardInvoiceService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendReceiptToPremier implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 120;

    public function __construct(
        private readonly int $receiptId,
        private readonly int $vendorId,
        private readonly int $glAccountId,
        private readonly int $userId,
    ) {}

    public function handle(): void
    {
        $receipt = CreditCardReceipt::find($this->receiptId);
        $vendor = PremierVendor::find($this->vendorId);
        $glAccount = PremierGlAccount::find($this->glAccountId);

        if (! $receipt || ! $vendor || ! $glAccount) {
            Log::error('SendReceiptToPremier: missing data', [
                'receipt_id' => $this->receiptId,
                'vendor_id' => $this->vendorId,
                'gl_account_id' => $this->glAccountId,
            ]);

            return;
        }

        $service = new CreditCardInvoiceService;
        $payload = $service->generateInvoicePayload($receipt, $vendor, $glAccount);
        $result = $service->sendInvoiceToPremier($receipt, $payload);

        if ($result['success']) {
            $receipt->update([
                'premier_invoice_id' => $result['invoice_id'] ?? 'sent',
                'invoice_status' => 'success',
                'gl_account_id' => $glAccount->id,
                'is_reconciled' => true,
            ]);

            activity()
                ->performedOn($receipt)
                ->event('invoice created')
                ->causedBy($this->userId)
                ->log("CC Receipt #{$receipt->id} sent to Premier. Invoice ID: " . ($result['invoice_id'] ?? 'N/A'));
        } else {
            $receipt->update(['invoice_status' => 'failed']);

            activity()
                ->performedOn($receipt)
                ->event('invoice failed')
                ->causedBy($this->userId)
                ->log("CC Receipt #{$receipt->id} failed: " . ($result['message'] ?? 'Unknown error'));
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('SendReceiptToPremier: job failed', [
            'receipt_id' => $this->receiptId,
            'error' => $exception->getMessage(),
        ]);

        $receipt = CreditCardReceipt::find($this->receiptId);
        $receipt?->update(['invoice_status' => 'failed']);
    }
}
