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
