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
