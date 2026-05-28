<?php

namespace App\Jobs;

use App\Jobs\Concerns\SyncsPremierODataByDateWindow;
use App\Models\ApPurchaseOrder;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class LoadApPurchaseOrders implements ShouldQueue
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
        \Illuminate\Support\Facades\Log::error('LoadApPurchaseOrders: Job failed permanently after all retries', [
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
        return 'ap_purchase_orders';
    }

    protected function endpointConfigKey(): string
    {
        return 'ap_purchase_orders';
    }

    protected function modelClass(): string
    {
        return ApPurchaseOrder::class;
    }

    protected function oDataDateColumn(): string
    {
        return 'PO_Date';
    }

    protected function dbDateColumn(): string
    {
        return 'po_date';
    }

    protected function mapRowToRecord(array $r): array
    {
        return [
            'client_id' => $r['ClientId'] ?? null,
            'company' => $r['Company'] ?? null,
            'job_number' => $r['Job_Number'] ?? null,
            'po_number' => $r['PO_Number'] ?? null,
            'po_date' => $this->parseDate($r['PO_Date'] ?? null),
            'po_required_date' => $this->parseDate($r['PO_Required_Date'] ?? null),
            'line' => $r['Line'] ?? null,
            'item_code' => $r['Item_Code'] ?? null,
            'cost_item' => $r['Cost_Item'] ?? null,
            'cost_type' => $r['Cost_Type'] ?? null,
            'department' => $r['Department'] ?? null,
            'location' => $r['Location'] ?? null,
            'vendor_code' => $r['Vendor_Code'] ?? null,
            'vendor_name' => $r['VendorName'] ?? null,
            'description' => $r['Description'] ?? null,
            'qty' => isset($r['Qty']) ? (float) $r['Qty'] : 0,
            'uofm' => $r['UofM'] ?? null,
            'unit_cost' => isset($r['Unit_Cost']) ? (float) $r['Unit_Cost'] : 0,
            'amount' => isset($r['Amount']) ? (float) $r['Amount'] : 0,
            'created_by' => $r['CreatedBy'] ?? null,
            'ship_to_type' => $r['Ship_To_Type'] ?? null,
            'status' => $r['Status'] ?? null,
            'approval_status' => $r['Approval_Status'] ?? null,
            'key' => $r['Key'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    private function parseDate(?string $dateString): ?string
    {
        if (empty($dateString)) {
            return null;
        }

        if (preg_match('/\/Date\((\d+)\)\//', $dateString, $m)) {
            return Carbon::createFromTimestampMsUTC((int) $m[1])->toDateString();
        }

        try {
            return Carbon::parse($dateString)->toDateString();
        } catch (\Exception $e) {
            return null;
        }
    }
}
