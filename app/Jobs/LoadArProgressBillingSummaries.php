<?php

namespace App\Jobs;

use App\Models\ArProgressBillingSummary;
use App\Models\JobCostDetail;
use App\Models\JobReportByCostItemAndCostType;
use AWS\CRT\Log;
use Carbon\Carbon;
use DB;
use Http;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Validator;

class LoadArProgressBillingSummaries implements ShouldQueue
{
    use Dispatchable, Queueable;

    /**
     * Create a new job instance.
     */

    private $url;
    public function __construct()
    {
        $this->url = 'https://reporting.jonas-premier.com/OData/ODataService.svc/ARProgressBillingSummaries';
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $response = Http::withBasicAuth(env('PREMIER_POWERBI_USER'), env('PREMIER_POWERBI_PW'))
            ->withHeaders([
                'Accept' => 'application/json',
                'DataServiceVersion' => '2.0',
                'MaxDataServiceVersion' => '2.0',
            ])
            ->get($this->url);

        if (!$response->successful()) {
            \Log::error('Failed to load Job Cost Details.', ['status' => $response->status(), 'body' => $response->body()]);
            return;
        }

        $json = $response->json();

        // OData v2: rows are usually in d.results, but yours is d.{0,1,2...}
        $rows = $json['d']['results'] ?? array_values($json['d'] ?? []);

        $data = array_map(function ($r) {
            $fromMs = null;
            $periodMs = null;

            if (!empty($r['From_Date']) && preg_match('/\/Date\((\d+)\)\//', $r['From_Date'], $m)) {
                $fromMs = (int) $m[1];
            }

            if (!empty($r['Period_End_Date']) && preg_match('/\/Date\((\d+)\)\//', $r['Period_End_Date'], $m)) {
                $periodMs = (int) $m[1];
            }

            return [
                'job_number' => $r['Job_Number'] ?? null,
                'application_number' => $r['Application_Number'] ?? null,
                'description' => $r['Description'] ?? null,
                'from_date' => $fromMs ? Carbon::createFromTimestampMsUTC($fromMs)->toDateString() : null,
                'period_end_date' => $periodMs ? Carbon::createFromTimestampMsUTC($periodMs)->toDateString() : null,
                'status_name' => $r['Status_Name'] ?? null,
                'this_app_work_completed' => isset($r['This_App_Work_Completed']) ? (float) $r['This_App_Work_Completed'] : null,
                'contract_sum_to_date' => isset($r['Contract_Sum_To_Date']) ? (float) $r['Contract_Sum_To_Date'] : null,
            ];
        }, $rows);
        \Log::info('data', $data);
        if (count($data) === 0) {
            \Log::warning('ERP returned 0 rows; skipping truncate+insert.');
            return;
        }

        $conn = ArProgressBillingSummary::query()->getConnection();

        $conn->transaction(function () use ($data) {
            ArProgressBillingSummary::query()->delete();

            $i = 0;
            foreach (array_chunk($data, 2000) as $chunk) {
                $i++;
                \Log::info("START chunk {$i}", ['rows' => count($chunk)]);
                ArProgressBillingSummary::insert($chunk);
                \Log::info("DONE  chunk {$i}", ['db_count_now' => ArProgressBillingSummary::count()]);
            }
        });

        \Log::info('Job Cost Details loaded successfully.', ['count' => count($rows)]);
    }
}
