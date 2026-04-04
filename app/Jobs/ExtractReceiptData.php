<?php

namespace App\Jobs;

use App\Models\CreditCardReceipt;
use App\Services\ReceiptExtractionService;
use App\Services\ReceiptImageProcessorService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ExtractReceiptData implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public int $timeout = 120;

    public function __construct(
        private readonly int $receiptId
    ) {}

    public function handle(ReceiptExtractionService $service, ReceiptImageProcessorService $imageProcessor): void
    {
        $receipt = CreditCardReceipt::find($this->receiptId);

        if (! $receipt) {
            Log::warning('Receipt not found for extraction', ['receipt_id' => $this->receiptId]);

            return;
        }

        // Process image first (non-blocking — failure doesn't affect extraction)
        $imageProcessor->process($receipt);

        $result = $service->extract($receipt);

        if ($result['success']) {
            $data = $result['data'];

            $category = $data['category'] ?? null;
            if ($category && ! in_array($category, CreditCardReceipt::CATEGORIES)) {
                $category = 'other';
            }

            $receipt->update([
                'merchant_name' => $data['merchant_name'] ?? $receipt->merchant_name,
                'total_amount' => $data['total_amount'] ?? $receipt->total_amount,
                'gst_amount' => $data['gst_amount'] ?? $receipt->gst_amount,
                'currency' => $data['currency'] ?? $receipt->currency,
                'transaction_date' => $data['transaction_date'] ?? $receipt->transaction_date,
                'category' => $category ?? $receipt->category,
                'extraction_status' => CreditCardReceipt::STATUS_COMPLETED,
                'raw_extraction' => $result['raw'],
            ]);
        } else {
            $receipt->update([
                'extraction_status' => CreditCardReceipt::STATUS_FAILED,
                'raw_extraction' => ['error' => $result['error'], 'raw' => $result['raw'] ?? null],
            ]);
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Receipt extraction job failed permanently', [
            'receipt_id' => $this->receiptId,
            'error' => $exception->getMessage(),
        ]);

        $receipt = CreditCardReceipt::find($this->receiptId);
        $receipt?->update([
            'extraction_status' => CreditCardReceipt::STATUS_FAILED,
            'raw_extraction' => ['error' => $exception->getMessage()],
        ]);
    }
}
