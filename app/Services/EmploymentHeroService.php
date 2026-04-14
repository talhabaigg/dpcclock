<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class EmploymentHeroService
{
    protected string $apiKey;

    protected string $baseUrl;

    protected string $businessId;

    public function __construct()
    {
        $this->apiKey = config('services.employment_hero.api_key');
        $this->baseUrl = config('services.employment_hero.base_url');
        $this->businessId = config('services.employment_hero.business_id');
    }

    /**
     * Get all business locations from Employment Hero.
     */
    public function getLocations(): array
    {
        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($this->apiKey.':'),
        ])->get("{$this->baseUrl}/business/{$this->businessId}/location");

        if ($response->failed()) {
            Log::error('Failed to get locations from Employment Hero', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new \RuntimeException('Failed to get locations: '.$response->body());
        }

        return $response->json();
    }

    /**
     * Get the current unstructured employee data from Employment Hero.
     */
    public function getEmployee(string $employeeId): array
    {
        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($this->apiKey.':'),
        ])->get("{$this->baseUrl}/business/{$this->businessId}/employee/unstructured/{$employeeId}");

        if ($response->failed()) {
            Log::error('Failed to get employee from Employment Hero', [
                'employeeId' => $employeeId,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new \RuntimeException('Failed to get employee: '.$response->body());
        }

        return $response->json();
    }

    /**
     * Update employee locations via the unstructured employee PUT endpoint.
     * The locations field is a pipe-separated string of location names.
     */
    public function updateEmployeeLocations(string $employeeId, string $locations): array
    {
        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($this->apiKey.':'),
            'Content-Type' => 'application/json',
        ])->put("{$this->baseUrl}/business/{$this->businessId}/employee/unstructured/{$employeeId}", [
            'locations' => $locations,
        ]);

        if ($response->failed()) {
            Log::error('Failed to update employee locations', [
                'employeeId' => $employeeId,
                'locations' => $locations,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new \RuntimeException('Failed to update employee locations: '.$response->body());
        }

        return $response->json();
    }

    /**
     * List pay runs for the business, optionally filtered by date range.
     */
    public function getPayRuns(?string $fromDate = null, ?string $toDate = null): array
    {
        $query = [];
        if ($fromDate) {
            $query['filter.fromDate'] = $fromDate;
        }
        if ($toDate) {
            $query['filter.toDate'] = $toDate;
        }

        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($this->apiKey.':'),
        ])->get("{$this->baseUrl}/business/{$this->businessId}/payrun", $query);

        if ($response->failed()) {
            Log::error('Failed to get pay runs from Employment Hero', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new \RuntimeException('Failed to get pay runs: '.$response->body());
        }

        return $response->json();
    }

    /**
     * Get leave accruals for a specific pay run.
     */
    public function getLeaveAccruals(int $payRunId, bool $includeLeaveTaken = true): array
    {
        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($this->apiKey.':'),
        ])->get("{$this->baseUrl}/business/{$this->businessId}/payrun/{$payRunId}/leaveaccrued", [
            'includeLeaveTaken' => $includeLeaveTaken ? 'true' : 'false',
        ]);

        if ($response->failed()) {
            Log::error('Failed to get leave accruals from Employment Hero', [
                'payRunId' => $payRunId,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new \RuntimeException('Failed to get leave accruals: '.$response->body());
        }

        return $response->json();
    }

    /**
     * Get leave balances report as at a given date.
     */
    public function getLeaveBalances(string $asAtDate): array
    {
        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($this->apiKey.':'),
        ])->timeout(60)->get("{$this->baseUrl}/business/{$this->businessId}/report/leavebalances", [
            'asAtDate' => $asAtDate,
        ]);

        if ($response->failed()) {
            Log::error('Failed to get leave balances from Employment Hero', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new \RuntimeException('Failed to get leave balances: '.$response->body());
        }

        return $response->json();
    }

    /**
     * Fetch leave balances for many dates concurrently.
     * Returns a map of asAtDate => balances array.
     *
     * EH rate-limits concurrent requests to this endpoint, so we cap the pool
     * size and retry 429s with backoff.
     */
    public function getLeaveBalancesBatch(array $asAtDates): array
    {
        if (empty($asAtDates)) {
            return [];
        }

        $auth = 'Basic '.base64_encode($this->apiKey.':');
        $url = "{$this->baseUrl}/business/{$this->businessId}/report/leavebalances";
        $chunks = array_chunk($asAtDates, 3);

        $result = [];
        foreach ($chunks as $chunk) {
            $responses = Http::pool(fn ($pool) => array_map(
                fn ($date) => $pool->as($date)
                    ->withHeaders(['Authorization' => $auth])
                    ->timeout(120)
                    ->retry(3, 2000, fn ($exception, $request) => true, throw: false)
                    ->get($url, ['asAtDate' => $date]),
                $chunk
            ));

            foreach ($chunk as $date) {
                $response = $responses[$date] ?? null;
                if (!$response || $response->failed()) {
                    Log::error('Failed to get leave balances from Employment Hero (batch)', [
                        'asAtDate' => $date,
                        'status' => $response?->status(),
                        'body' => $response?->body(),
                    ]);
                    throw new \RuntimeException('Failed to get leave balances for '.$date);
                }
                $result[$date] = $response->json();
            }
        }

        return $result;
    }

    public function initiateSelfServiceOnboarding(array $data): array
    {
        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($this->apiKey.':'),
            'Content-Type' => 'application/json',
        ])->post("{$this->baseUrl}/business/{$this->businessId}/employeeonboarding/initiateselfservice", $data);

        if ($response->failed()) {
            Log::error('Employment Hero onboarding failed', [
                'status' => $response->status(),
                'body' => $response->body(),
                'data' => array_diff_key($data, array_flip(['email'])),
            ]);

            throw new \RuntimeException(
                'Failed to initiate payroll onboarding: '.$response->body()
            );
        }

        return $response->json();
    }
}
