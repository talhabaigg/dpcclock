<?php

namespace App\Jobs;

use App\Jobs\Concerns\SyncsPremierODataByDateWindow;
use App\Models\JobCostDetail;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class LoadJobCostData implements ShouldQueue
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
        Log::error('LoadJobCostDetails: Job failed permanently after all retries', [
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
        return 'job_cost_data';
    }

    protected function endpointConfigKey(): string
    {
        return 'job_cost_details';
    }

    protected function modelClass(): string
    {
        return JobCostDetail::class;
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
            'job_number' => $r['Job_Number'] ?? null,
            'job_name' => $r['Job_Name'] ?? null,
            'cost_item' => $r['Cost_Item'] ?? null,
            'cost_type' => $r['Cost_Type'] ?? null,
            'transaction_date' => $this->parseODataDate($r['Transaction_Date'] ?? null),
            'description' => $r['Description'] ?? null,
            'transaction_type' => $r['Transaction_Type'] ?? null,
            'ref_number' => $r['Ref_Number'] ?? null,
            'amount' => isset($r['Amount']) ? (float) $r['Amount'] : null,
            'company_code' => $r['Company_Code'] ?? null,
            'cost_item_description' => $r['Cost_Item_Description'] ?? null,
            'cost_type_description' => $r['Cost_Type_Description'] ?? null,
            'project_manager' => $r['Project_Manager'] ?? null,
            'quantity' => isset($r['Quantity']) ? (float) $r['Quantity'] : null,
            'unit_cost' => isset($r['Unit_Cost_plus_Tax1']) ? (float) $r['Unit_Cost_plus_Tax1'] : null,
            'vendor' => $r['Vendor'] ?? null,
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
