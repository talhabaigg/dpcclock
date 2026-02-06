<?php

namespace App\Jobs;

use App\Models\Location;
use App\Models\Variation;
use App\Services\GetCompanyCodeService;
use App\Services\PremierAuthenticationService;
use App\Services\VariationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class LoadVariationsFromPremierJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     *
     * @var int
     */
    public $tries = 3;

    /**
     * The number of seconds the job can run before timing out.
     *
     * @var int
     */
    public $timeout = 300;

    /**
     * The location to sync variations for.
     */
    protected Location $location;

    /**
     * Create a new job instance.
     */
    public function __construct(Location $location)
    {
        $this->location = $location;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $startTime = now();
        Log::info('LoadVariationsFromPremierJob: Started', [
            'location_id' => $this->location->id,
            'location_name' => $this->location->name,
        ]);

        try {
            $authService = new PremierAuthenticationService;
            $token = $authService->getAccessToken();

            $companyService = new GetCompanyCodeService;
            $companyId = $companyService->getCompanyCode($this->location->eh_parent_id);

            $variationService = new VariationService;
            $response = $variationService->getChangeOrders($this->location, $companyId, $token);

            if (! $response->ok()) {
                throw new \RuntimeException(
                    'Failed to fetch variations from Premier: '.json_encode($response->json())
                );
            }

            $data = $response->json('Data');
            $variationsProcessed = 0;

            foreach ($data as $item) {
                $variation = Variation::updateOrCreate(
                    [
                        'premier_co_id' => $item['ChangeOrderID'],
                    ],
                    [
                        'co_number' => $item['ChangeOrderNumber'],
                        'location_id' => $this->location->id,
                        'type' => $item['ChangeTypeCode'] ?? 'N/A',
                        'description' => $item['Description'],
                        'co_date' => $item['CODate'],
                        'status' => $item['COStatus'],
                        'premier_co_id' => $item['ChangeOrderID'],
                    ]
                );

                $lines = $variationService->getChangeOrderLines($item['ChangeOrderID'], $companyId, $token);

                if ($lines->ok()) {
                    $lineData = $lines->json('Data');
                    $latestLineNumbers = collect($lineData)
                        ->pluck('LineNumber')
                        ->filter()
                        ->unique()
                        ->values()
                        ->toArray();

                    foreach ($lineData as $line) {
                        $variation->lineItems()->updateOrCreate(
                            ['line_number' => $line['LineNumber']],
                            [
                                'description' => $line['CostItemDescription'],
                                'qty' => $line['Quantity'] ?? 1,
                                'unit_cost' => $line['UnitCost'] ?? 0,
                                'total_cost' => $line['Cost'] ?? 0,
                                'revenue' => $line['Revenue'] ?? 0,
                                'cost_item' => $line['CostItemCode'],
                                'cost_type' => $line['CostTypeCode'],
                            ]
                        );
                    }

                    $variation->lineItems()
                        ->whereNotIn('line_number', $latestLineNumbers)
                        ->delete();
                }

                $variationsProcessed++;
            }

            $duration = now()->diffInSeconds($startTime);
            Log::info('LoadVariationsFromPremierJob: Completed successfully', [
                'location_id' => $this->location->id,
                'variations_processed' => $variationsProcessed,
                'duration_seconds' => $duration,
            ]);

        } catch (Throwable $e) {
            Log::error('LoadVariationsFromPremierJob: Failed', [
                'location_id' => $this->location->id,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(Throwable $exception): void
    {
        Log::error('LoadVariationsFromPremierJob: Failed permanently after all retries', [
            'location_id' => $this->location->id,
            'error' => $exception->getMessage(),
            'attempts' => $this->attempts(),
        ]);
    }

    /**
     * Calculate the number of seconds to wait before retrying the job.
     */
    public function backoff(): array
    {
        return [60, 120, 240];
    }
}
