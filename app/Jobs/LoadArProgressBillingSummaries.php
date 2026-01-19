<?php

namespace App\Jobs;

use App\Models\ArProgressBillingSummary;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class LoadArProgressBillingSummaries implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     *
     * @var int
     */
    public $tries;

    /**
     * The number of seconds the job can run before timing out.
     *
     * @var int
     */
    public $timeout;

    /**
     * Create a new job instance.
     */
    public function __construct()
    {
        $this->tries = config('premier.jobs.retry_times', 3);
        $this->timeout = config('premier.jobs.timeout', 600);
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $startTime = now();
        Log::info('LoadArProgressBillingSummaries: Job started');

        try {
            $baseUrl = config('premier.api.base_url') . config('premier.endpoints.ar_progress_billing');
            $insertBatchSize = 100; // Smaller batch size for inserts due to many columns
            $pageSize = 200; // Smaller OData page size for API requests
            $skip = 0;
            $totalProcessed = 0;
            $isFirstBatch = true;

            do {
                // Fetch data in pages using OData $skip and $top
                $url = $baseUrl . '?$top=' . $pageSize . '&$skip=' . $skip;

                Log::info("LoadArProgressBillingSummaries: Fetching page", [
                    'skip' => $skip,
                    'top' => $pageSize
                ]);

                $response = Http::timeout(config('premier.api.timeout', 300))
                    ->withBasicAuth(
                        config('premier.api.username'),
                        config('premier.api.password')
                    )
                    ->withHeaders([
                        'Accept' => 'application/json',
                        'DataServiceVersion' => '2.0',
                        'MaxDataServiceVersion' => '2.0',
                    ])
                    ->get($url);

                if (!$response->successful()) {
                    throw new \RuntimeException(
                        "API request failed with status {$response->status()}: {$response->body()}"
                    );
                }

                $json = $response->json();
                unset($response); // Free response memory immediately

                // Validate response structure
                if (!isset($json['d'])) {
                    throw new \RuntimeException('Invalid API response structure: missing "d" property');
                }

                // OData v2: rows are usually in d.results, but can also be d.{0,1,2...}
                $rows = $json['d']['results'] ?? array_values($json['d'] ?? []);
                unset($json); // Free json memory immediately

                if (!is_array($rows)) {
                    throw new \RuntimeException('Invalid API response: expected array of rows');
                }

                $rowCount = count($rows);

                if ($rowCount === 0 && $isFirstBatch) {
                    Log::warning('LoadArProgressBillingSummaries: ERP returned 0 rows, skipping database update');
                    return;
                }

                if ($rowCount === 0) {
                    break; // No more records to fetch
                }

                Log::info('LoadArProgressBillingSummaries: Processing page', [
                    'rows' => $rowCount,
                    'skip' => $skip
                ]);

                // On first batch, delete all existing records
                if ($isFirstBatch) {
                    ArProgressBillingSummary::query()->delete();
                    $isFirstBatch = false;
                }

                // Process and insert data in smaller chunks to reduce memory usage
                $chunks = array_chunk($rows, $insertBatchSize);
                unset($rows); // Free rows memory

                foreach ($chunks as $chunk) {
                    $data = [];
                    foreach ($chunk as $r) {
                        $data[] = $this->mapRowToRecord($r);
                    }
                    ArProgressBillingSummary::insert($data);
                    unset($data);
                }
                unset($chunks);

                $totalProcessed += $rowCount;
                $skip += $pageSize;

                // Force garbage collection
                gc_collect_cycles();

            } while ($rowCount === $pageSize); // Continue if we got a full page

            $duration = now()->diffInSeconds($startTime);
            Log::info('LoadArProgressBillingSummaries: Job completed successfully', [
                'records_processed' => $totalProcessed,
                'duration_seconds' => $duration
            ]);

        } catch (Throwable $e) {
            Log::error('LoadArProgressBillingSummaries: Job failed', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            throw $e;
        }
    }

    /**
     * Map an API row to a database record.
     */
    private function mapRowToRecord(array $r): array
    {
        $fromMs = null;
        $periodMs = null;
        $insertMs = null;
        $updateMs = null;

        if (!empty($r['From_Date']) && preg_match('/\/Date\((\d+)\)\//', $r['From_Date'], $m)) {
            $fromMs = (int) $m[1];
        }

        if (!empty($r['Period_End_Date']) && preg_match('/\/Date\((\d+)\)\//', $r['Period_End_Date'], $m)) {
            $periodMs = (int) $m[1];
        }

        if (!empty($r['Insert_Date']) && preg_match('/\/Date\((\d+)\)\//', $r['Insert_Date'], $m)) {
            $insertMs = (int) $m[1];
        }

        if (!empty($r['Update_Date']) && preg_match('/\/Date\((\d+)\)\//', $r['Update_Date'], $m)) {
            $updateMs = (int) $m[1];
        }

        return [
            'client_id' => $r['ClientId'] ?? null,
            'company_code' => $r['Company_Code'] ?? null,
            'job_number' => $r['Job_Number'] ?? null,
            'progress_billing_report_number' => $r['Progress_Billing_Report_Number'] ?? null,
            'application_number' => $r['Application_Number'] ?? null,
            'description' => $r['Description'] ?? null,
            'from_date' => $fromMs ? Carbon::createFromTimestampMsUTC($fromMs)->toDateString() : null,
            'period_end_date' => $periodMs ? Carbon::createFromTimestampMsUTC($periodMs)->toDateString() : null,
            'status_name' => $r['Status_Name'] ?? null,
            'this_app_work_completed' => isset($r['This_App_Work_Completed']) ? (float) $r['This_App_Work_Completed'] : null,
            'materials_stored' => isset($r['Materials_Stored']) ? (float) $r['Materials_Stored'] : null,
            'total_completed_and_stored_to_date' => isset($r['Total_Completed_And_Stored_To_Date']) ? (float) $r['Total_Completed_And_Stored_To_Date'] : null,
            'percentage' => isset($r['Percentage']) ? (float) $r['Percentage'] : null,
            'balance_to_finish' => isset($r['Balance_To_Finish']) ? (float) $r['Balance_To_Finish'] : null,
            'this_app_retainage' => isset($r['This_App_Retainage']) ? (float) $r['This_App_Retainage'] : null,
            'application_retainage_released' => isset($r['Application_Retainage_Released']) ? (float) $r['Application_Retainage_Released'] : null,
            'original_contract_sum' => isset($r['Original_Contract_Sum']) ? (float) $r['Original_Contract_Sum'] : null,
            'authorized_changes_to_date' => isset($r['Authorized_Changes_To_Date']) ? (float) $r['Authorized_Changes_To_Date'] : null,
            'contract_sum_to_date' => isset($r['Contract_Sum_To_Date']) ? (float) $r['Contract_Sum_To_Date'] : null,
            'retainage_to_date' => isset($r['Retainage_To_Date']) ? (float) $r['Retainage_To_Date'] : null,
            'total_earned_less_retainage' => isset($r['Total_Earned_Less_Retainage']) ? (float) $r['Total_Earned_Less_Retainage'] : null,
            'less_previous_applications' => isset($r['Less_Previous_Applications']) ? (float) $r['Less_Previous_Applications'] : null,
            'amount_payable_this_application' => isset($r['Amount_Payable_This_Application']) ? (float) $r['Amount_Payable_This_Application'] : null,
            'balance_to_finish_including_retainage' => isset($r['Balance_To_Finish_Including_Retainage']) ? (float) $r['Balance_To_Finish_Including_Retainage'] : null,
            'previous_materials_stored' => isset($r['Previous_Materials_Stored']) ? (float) $r['Previous_Materials_Stored'] : null,
            'invoice_number' => $r['Invoice_Number'] ?? null,
            'active' => $r['Active'] ?? null,
            'insert_user' => $r['Insert_User'] ?? null,
            'insert_date' => $insertMs ? Carbon::createFromTimestampMsUTC($insertMs)->toDateString() : null,
            'update_user' => $r['Update_User'] ?? null,
            'update_date' => $updateMs ? Carbon::createFromTimestampMsUTC($updateMs)->toDateString() : null,
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    /**
     * Handle a job failure.
     */
    public function failed(Throwable $exception): void
    {
        Log::error('LoadArProgressBillingSummaries: Job failed permanently after all retries', [
            'error' => $exception->getMessage(),
            'attempts' => $this->attempts()
        ]);

        // Here you could send notifications to administrators
        // Example: notify(new JobFailedNotification($exception));
    }

    /**
     * Calculate the number of seconds to wait before retrying the job.
     */
    public function backoff(): array
    {
        // Exponential backoff: 1 minute, 2 minutes, 4 minutes
        return [60, 120, 240];
    }
}
