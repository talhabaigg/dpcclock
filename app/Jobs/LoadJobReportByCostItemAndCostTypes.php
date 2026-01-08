<?php

namespace App\Jobs;

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

class LoadJobReportByCostItemAndCostTypes implements ShouldQueue
{
    use Dispatchable, Queueable;

    /**
     * Create a new job instance.
     */

    private $url;
    public function __construct()
    {
        $this->url = 'https://reporting.jonas-premier.com/OData/ODataService.svc/JobReportByCostItemAndCostTypes';
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


            return [
                'job_number' => $r['Job_Number'] ?? null,
                'cost_item' => $r['Cost_Item'] ?? null,
                'original_estimate' => isset($r['Original_Estimate']) ? (float) $r['Original_Estimate'] : null,
                'current_estimate' => isset($r['Current_Estimate']) ? (float) $r['Current_Estimate'] : null,
                'estimate_at_completion' => isset($r['Estimate_At_Completion']) ? (float) $r['Estimate_At_Completion'] : null,
                'estimate_to_completion' => isset($r['Estimate_To_Completion']) ? (float) $r['Estimate_To_Completion'] : null,
            ];
        }, $rows);
        \Log::info('data', $data);
        if (count($data) === 0) {
            \Log::warning('ERP returned 0 rows; skipping truncate+insert.');
            return;
        }

        $conn = JobReportByCostItemAndCostType::query()->getConnection();

        $conn->transaction(function () use ($data) {
            JobReportByCostItemAndCostType::query()->delete();

            $i = 0;
            foreach (array_chunk($data, 2000) as $chunk) {
                $i++;
                \Log::info("START chunk {$i}", ['rows' => count($chunk)]);
                JobReportByCostItemAndCostType::insert($chunk);
                \Log::info("DONE  chunk {$i}", ['db_count_now' => JobReportByCostItemAndCostType::count()]);
            }
        });

        \Log::info('Job Cost Details loaded successfully.', ['count' => count($rows)]);
    }
}
