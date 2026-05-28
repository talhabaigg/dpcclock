<?php

namespace App\Jobs;

use App\Jobs\Concerns\SyncsPremierODataByDateWindow;
use App\Models\ArPostedInvoice;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class LoadArPostedInvoices implements ShouldQueue
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
        \Illuminate\Support\Facades\Log::error('LoadArPostedInvoices: Job failed permanently after all retries', [
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
        return 'ar_posted_invoices';
    }

    protected function endpointConfigKey(): string
    {
        return 'ar_posted_invoices';
    }

    protected function modelClass(): string
    {
        return ArPostedInvoice::class;
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
            'contract_customer_code' => $r['Contract_Customer_Code'] ?? null,
            'contract_customer_name' => $r['Contract_Customer_Name'] ?? null,
            'mail_to_customer_code' => $r['Mail_To_Customer_Code'] ?? null,
            'mail_to_customer_name' => $r['Mail_To_Customer_Name'] ?? null,
            'bill_to_customer_code' => $r['Bill_To_Customer_Code'] ?? null,
            'bill_to_customer_name' => $r['Bill_To_Customer_Name'] ?? null,
            'job_number' => $r['Job_Number'] ?? null,
            'job_name' => $r['Job_Name'] ?? null,
            'invoice_number' => $r['Invoice_Number'] ?? null,
            'invoice_date' => $this->parseODataDate($r['Invoice_Date'] ?? null),
            'due_date' => $this->parseODataDate($r['Due_Date'] ?? null),
            'transaction_date' => $this->parseODataDate($r['Transaction_Date'] ?? null),
            'subtotal' => isset($r['Subtotal']) ? (float) $r['Subtotal'] : null,
            'tax1' => isset($r['Tax1']) ? (float) $r['Tax1'] : null,
            'tax2' => isset($r['Tax2']) ? (float) $r['Tax2'] : null,
            'freight' => isset($r['Freight']) ? (float) $r['Freight'] : null,
            'discount' => isset($r['Discount']) ? (float) $r['Discount'] : null,
            'retainage' => isset($r['Retainage']) ? (float) $r['Retainage'] : null,
            'total' => isset($r['Total']) ? (float) $r['Total'] : null,
            'sales_category' => $r['Sales_Category'] ?? null,
            'memo' => $r['Memo'] ?? null,
            'invoice_status' => $r['Invoice_Status'] ?? null,
            'key' => $r['Key'] ?? null,
            'ar_subledger_code' => $r['AR_Subledger_Code'] ?? null,
            'currency_code' => $r['Currency_Code'] ?? null,
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
