<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class PremierAuthenticationService
{
    protected string $authUrl = 'https://api.jonas-premier.com/Authenticate';
    protected string $cacheKey = 'premier_api_access_token';

    /**
     * Get a valid Premier API token (cached for 29 minutes).
     *
     * @return string
     * @throws \Exception
     */
    public function getAccessToken(): string
    {
        // Return cached token if it exists
        if (Cache::has($this->cacheKey)) {
            return Cache::get($this->cacheKey);
        }

        // Authenticate and cache new token
        $response = Http::asForm()
            ->withHeaders([
                'Accept' => 'application/json',
            ])
            ->post($this->authUrl, [
                'grant_type' => 'password',
                'client_id' => 'Premier.ExternalAPI',
                'username' => env('PREMIER_SWAGGER_API_USERNAME'),
                'password' => env('PREMIER_SWAGGER_API_PASSWORD'),
            ]);

        if ($response->successful()) {
            $data = $response->json();

            $accessToken = $data['access_token'] ?? null;

            if (!$accessToken) {
                throw new \Exception('Access token missing in response.');
            }

            // Cache token for 29 minutes (token lifespan = 30)
            Cache::put($this->cacheKey, $accessToken, now()->addMinutes(29));

            return $accessToken;
        }

        // Log error response
        Log::error('Premier API authentication failed', ['response' => $response->body()]);

        throw new \Exception('Failed to authenticate with Jonas Premier API.');
    }
}
