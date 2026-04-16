<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeocodingService
{
    protected string $apiKey;

    public function __construct()
    {
        $this->apiKey = config('services.google.geocoding_key');
    }

    /**
     * Geocode an address string into lat/lng coordinates.
     *
     * @return array{lat: float, lng: float}|null
     */
    public function geocode(string $address): ?array
    {
        if (empty(trim($address)) || $this->isPlaceholder($address)) {
            return null;
        }

        try {
            $response = Http::get('https://maps.googleapis.com/maps/api/geocode/json', [
                'address' => $address,
                'key' => $this->apiKey,
                'region' => 'au',
            ]);

            if (! $response->successful()) {
                Log::warning('GeocodingService: API request failed', [
                    'status' => $response->status(),
                    'address' => $address,
                ]);

                return null;
            }

            $data = $response->json();

            if (($data['status'] ?? '') !== 'OK' || empty($data['results'])) {
                Log::info('GeocodingService: No results for address', [
                    'address' => $address,
                    'status' => $data['status'] ?? 'unknown',
                ]);

                return null;
            }

            $location = $data['results'][0]['geometry']['location'] ?? null;

            if (! $location || ! isset($location['lat'], $location['lng'])) {
                return null;
            }

            return [
                'lat' => (float) $location['lat'],
                'lng' => (float) $location['lng'],
            ];
        } catch (\Throwable $e) {
            Log::error('GeocodingService: Exception during geocoding', [
                'address' => $address,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Build a full address string from components.
     */
    public static function buildAddress(
        ?string $addressLine1,
        ?string $city,
        ?string $stateCode,
        ?string $zipCode,
        ?string $countryCode = 'AU'
    ): string {
        return collect([$addressLine1, $city, $stateCode, $zipCode, $countryCode])
            ->filter(fn ($part) => ! empty($part) && ! self::isPlaceholderStatic($part))
            ->implode(', ');
    }

    protected function isPlaceholder(string $value): bool
    {
        return self::isPlaceholderStatic($value);
    }

    protected static function isPlaceholderStatic(string $value): bool
    {
        $normalized = strtoupper(trim($value));

        return in_array($normalized, ['TBA', 'TBC', 'N/A', 'NA', '-', '']);
    }
}
