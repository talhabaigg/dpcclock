<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeocodingService
{
    public function geocode(string $address): ?array
    {
        $apiKey = config('services.google.geocoding_key');

        if (! $apiKey) {
            Log::warning('GeocodingService: GOOGLE_GEOCODING_API_KEY not configured');

            return null;
        }

        try {
            $response = Http::get('https://maps.googleapis.com/maps/api/geocode/json', [
                'address' => $address . ', Australia',
                'key' => $apiKey,
                'region' => 'au',
            ]);

            if (! $response->successful()) {
                Log::warning('GeocodingService: API request failed', ['status' => $response->status()]);

                return null;
            }

            $data = $response->json();

            if (($data['status'] ?? '') !== 'OK' || empty($data['results'])) {
                Log::info('GeocodingService: No results for address', ['address' => $address, 'status' => $data['status'] ?? 'unknown']);

                return null;
            }

            $location = $data['results'][0]['geometry']['location'];

            return [
                'latitude' => $location['lat'],
                'longitude' => $location['lng'],
            ];
        } catch (\Exception $e) {
            Log::error('GeocodingService: Exception during geocoding', ['error' => $e->getMessage(), 'address' => $address]);

            return null;
        }
    }
}
