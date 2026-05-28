<?php

namespace App\Jobs;

use App\Jobs\Concerns\SyncsPremierODataByDateWindow;
use App\Models\ApPostedInvoice;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class LoadApPostedInvoices implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels, SyncsPremierODataByDateWindow;

    public $tries;

    public $timeout;

    public function __construct(string $mode = 'incremental')
    {
        $this->tries = config('premier.jobs.retry_times', 3);
        $this->timeout = config('premier.jobs.timeout', 600);
        $this->mode = in_array($mode, self::MODES, true) ? $mode : 'incremental';
    }

    public function handle(): void
    {
        $this->runSync();
    }

    public function failed(Throwable $exception): void
    {
        \Illuminate\Support\Facades\Log::error('LoadApPostedInvoices: Job failed permanently after all retries', [
            'error' => $exception->getMessage(),
            'attempts' => $this->attempts(),
        ]);
    }

    public function backoff(): array
    {
        return [60, 120, 240];
    }

    protected function jobName(): string
    {
        return 'ap_posted_invoices';
    }

    protected function endpointConfigKey(): string
    {
        return 'ap_posted_invoices';
    }

    protected function modelClass(): string
    {
        return ApPostedInvoice::class;
    }

    protected function oDataDateColumn(): string
    {
        return 'Transaction_Date';
    }

    protected function dbDateColumn(): string
    {
        return 'transaction_date';
    }

    protected function mapRowToRecord(array $r): array
    {
        return [
            'client_id' => $r['ClientId'] ?? null,
            'company' => $r['Company'] ?? null,
            'vendor_code' => $r['Vendor_Code'] ?? null,
            'vendor' => $r['Vendor'] ?? null,
            'invoice_number' => $r['Invoice_Number'] ?? null,
            'unique_id' => $r['Unique_ID'] ?? null,
            'job_number' => $r['Job_Number'] ?? null,
            'po_number' => $r['PO__'] ?? null,
            'sub_number' => $r['SUB__'] ?? null,
            'invoice_date' => $this->parseODataDate($r['Invoice_Date'] ?? null),
            'due_date' => $this->parseODataDate($r['Due_Date'] ?? null),
            'received_date' => $this->parseODataDate($r['Received_Date'] ?? null),
            'transaction_date' => $this->parseODataDate($r['Transaction_Date'] ?? null),
            'subtotal' => isset($r['Subtotal']) ? (float) $r['Subtotal'] : null,
            'tax1' => isset($r['Tax1']) ? (float) $r['Tax1'] : null,
            'tax2' => isset($r['Tax2']) ? (float) $r['Tax2'] : null,
            'freight' => isset($r['Freight']) ? (float) $r['Freight'] : null,
            'discount' => isset($r['Discount']) ? (float) $r['Discount'] : null,
            'retainage' => isset($r['Retainage']) ? (float) $r['Retainage'] : null,
            'invoice_total' => isset($r['Invoice_Total']) ? (float) $r['Invoice_Total'] : null,
            'purchase_category' => $r['Purchase_Category'] ?? null,
            'invoice_status' => $r['Invoice_Status'] ?? null,
            'hold_code' => $r['Hold_Code'] ?? null,
            'hold_date' => $this->parseODataDate($r['Hold_Date'] ?? null),
            'release_date' => $this->parseODataDate($r['Release_Date'] ?? null),
            'approval_date' => $this->parseODataDate($r['Approval_Date'] ?? null),
            'approval_status' => $r['Approval_Status'] ?? null,
            'notes' => $r['Notes'] ?? null,
            'memo' => $r['Memo'] ?? null,
            'key' => $r['Key'] ?? null,
            'batch' => $r['Batch'] ?? null,
            'created_by' => $r['Created_by'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    private function parseODataDate(?string $dateString): ?string
    {
        if (empty($dateString)) {
            return null;
        }

        if (preg_match('/\/Date\((\d+)\)\//', $dateString, $m)) {
            return Carbon::createFromTimestampMsUTC((int) $m[1])->toDateString();
        }

        return null;
    }
}
