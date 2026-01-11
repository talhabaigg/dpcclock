<?php

namespace App\Jobs;

use App\Models\JobCostDetail;
use AWS\CRT\Log;
use Carbon\Carbon;
use DB;
use Http;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Validator;

class loadJobCostDetails implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new job instance.
     */

    private $url;
    public function __construct()
    {
        $this->url = 'https://reporting.jonas-premier.com/OData/ODataService.svc/JobCostDetails';
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

        // Map + normalize
        $data = array_map(function ($r) {
            $ms = null;
            if (!empty($r['Transaction_Date']) && preg_match('/\/Date\((\d+)\)\//', $r['Transaction_Date'], $m)) {
                $ms = (int) $m[1];
            }

            return [
                'job_number' => $r['Job_Number'] ?? null,
                'job_name' => $r['Job_Name'] ?? null,
                'cost_item' => $r['Cost_Item'] ?? null,
                'cost_type' => $r['Cost_Type'] ?? null,
                'transaction_date' => $ms ? Carbon::createFromTimestampMsUTC($ms)->toDateString() : null,
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
        }, $rows);

        if (count($data) === 0) {
            \Log::warning('ERP returned 0 rows; skipping truncate+insert.');
            return;
        }

        $conn = JobCostDetail::query()->getConnection();

        $conn->transaction(function () use ($data) {
            JobCostDetail::query()->delete();

            $i = 0;
            foreach (array_chunk($data, 1000) as $chunk) {
                $i++;
                \Log::info("START chunk {$i}", ['rows' => count($chunk)]);
                JobCostDetail::insert($chunk);
                \Log::info("DONE  chunk {$i}", ['db_count_now' => JobCostDetail::count()]);
            }
        });

        \Log::info('Job Cost Details loaded successfully.', ['count' => count($data)]);
    }
}
