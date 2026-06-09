<?php

namespace App\Jobs;

use App\Jobs\Concerns\SyncsPremierODataByDateWindow;
use App\Models\GlTransactionDetail;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class LoadGlTransactionDetails implements ShouldQueue
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
        \Illuminate\Support\Facades\Log::error('LoadGlTransactionDetails: Job failed permanently after all retries', [
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
        return 'gl_transaction_details';
    }

    protected function endpointConfigKey(): string
    {
        return 'gl_transaction_details';
    }

    protected function modelClass(): string
    {
        return GlTransactionDetail::class;
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
            'company_code' => $r['Company_Code'] ?? null,
            'transaction_date' => $this->parseDate($r['Transaction_Date'] ?? null),
            'journal_type' => $r['Journal_Type'] ?? null,
            'account' => $r['Account'] ?? null,
            'account_name' => $r['Account_Name'] ?? null,
            'sub_account' => $r['Sub_Account'] ?? null,
            'sub_account_name' => $r['Sub_Account_Name'] ?? null,
            'division' => $r['Division'] ?? null,
            'description' => $r['Description'] ?? null,
            'debit' => isset($r['Debit']) ? (float) $r['Debit'] : 0,
            'credit' => isset($r['Credit']) ? (float) $r['Credit'] : 0,
            'debit_for_currency' => isset($r['Debit_For_Currency']) ? (float) $r['Debit_For_Currency'] : 0,
            'credit_for_currency' => isset($r['Credit_For_Currency']) ? (float) $r['Credit_For_Currency'] : 0,
            'currency' => $r['Currency'] ?? null,
            'audit_number' => $r['Audit_Number'] ?? null,
            'reference_document_number' => $r['Reference_Doument_Number'] ?? null,
            'source_is_journal_entry' => $r['Source_IsJournal_Entry'] ?? false,
            'company_from' => $r['Company_From'] ?? null,
            'company_to' => $r['Company_To'] ?? null,
            'update_user' => $r['Update_User'] ?? null,
            'update_date' => $this->parseDate($r['Update_Date'] ?? null, includeTime: true),
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    private function parseDate(?string $dateString, bool $includeTime = false): ?string
    {
        if (empty($dateString)) {
            return null;
        }

        // Premier's OData v2 returns dates as /Date(<ms-since-epoch>)/. Their reporting DB
        // emits the calendar day as a timestamp somewhere on that UTC day. Pulling the date
        // straight off the UTC moment preserves Premier's intended calendar date.
        // Earlier code shifted to Australia/Brisbane before formatting which pushed any
        // afternoon-UTC value (== next day Brisbane) forward by one — the cause of an entire
        // batch of transaction_dates being one day later than Premier's own report.
        // For time-included fields we still want Brisbane so the timestamp reads as local.
        if (preg_match('/\/Date\((\d+)\)\//', $dateString, $m)) {
            $carbon = Carbon::createFromTimestampMsUTC((int) $m[1]);
            if ($includeTime) {
                return $carbon->setTimezone('Australia/Brisbane')->toDateTimeString();
            }

            return $carbon->toDateString();
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $dateString)) {
            $carbon = Carbon::parse($dateString);

            return $includeTime ? $carbon->toDateTimeString() : $carbon->toDateString();
        }

        return null;
    }
}
