<?php

namespace App\Jobs;

use App\Models\Location;
use App\Services\GeocodingService;
use App\Services\PremierAuthenticationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class SyncJobAddressesFromPremier implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;

    public $timeout = 120;

    public function handle(
        PremierAuthenticationService $auth,
        GeocodingService $geocoding
    ): void {
        Log::info('SyncJobAddressesFromPremier: Started');

        $token = $auth->getAccessToken();
        $baseUrl = config('premier.swagger_api.base_url');
        $companyIds = $this->getCompanyIds();

        $updated = 0;
        $geocoded = 0;

        foreach ($companyIds as $companyId) {
            $response = Http::timeout(60)
                ->withToken($token)
                ->withHeaders(['Accept' => 'application/json'])
                ->get($baseUrl.'/api/Job/GetJobs', ['CompanyId' => $companyId, 'PageSize' => 500]);

            if (! $response->successful()) {
                Log::warning('SyncJobAddressesFromPremier: API failed for company', [
                    'company_id' => $companyId,
                    'status' => $response->status(),
                ]);

                continue;
            }

            $data = $response->json();
            $jobs = $data['Data'] ?? [];

            foreach ($jobs as $job) {
                $jobNumber = $job['JobNumber'] ?? null;
                if (! $jobNumber) {
                    continue;
                }

                $location = Location::where('external_id', $jobNumber)->first();
                if (! $location) {
                    continue;
                }

                $addressChanged = $this->updateAddress($location, $job);

                if ($addressChanged) {
                    $updated++;
                }

                // Skip geocoding if address_line1 is a placeholder
                $addr1 = strtoupper(trim($location->address_line1 ?? ''));
                if (in_array($addr1, ['TBA', 'TBC', 'N/A', 'NA', '-', ''])) {
                    if ($location->latitude !== null) {
                        $location->update(['latitude' => null, 'longitude' => null]);
                    }
                    continue;
                }

                // Geocode if address changed or coordinates are missing
                $needsGeocode = $addressChanged || $location->latitude === null;
                if (! $needsGeocode) {
                    continue;
                }

                $fullAddress = GeocodingService::buildAddress(
                    $location->address_line1,
                    $location->city,
                    $location->state_code,
                    $location->zip_code,
                    $location->country_code
                );

                if (! empty($fullAddress)) {
                    $coords = $geocoding->geocode($fullAddress);

                    if ($coords) {
                        $location->update([
                            'latitude' => $coords['lat'],
                            'longitude' => $coords['lng'],
                        ]);
                        $geocoded++;
                    }
                }
            }
        }

        Log::info('SyncJobAddressesFromPremier: Completed', [
            'addresses_updated' => $updated,
            'geocoded' => $geocoded,
        ]);
    }

    protected function updateAddress(Location $location, array $job): bool
    {
        $newAddress = [
            'address_line1' => $job['AddressLine1'] ?? null,
            'city' => $job['City'] ?? null,
            'state_code' => $job['StateCode'] ?? null,
            'country_code' => $job['CountryCode'] ?? null,
            'zip_code' => $job['ZipCode'] ?? null,
        ];

        $changed = false;
        foreach ($newAddress as $field => $value) {
            if ($location->$field !== $value) {
                $changed = true;
                break;
            }
        }

        if ($changed) {
            $location->update($newAddress);
        }

        return $changed;
    }

    protected function getCompanyIds(): array
    {
        return array_filter([
            config('premier.swcp_company_id'),
        ]);
    }

    public function failed(Throwable $exception): void
    {
        Log::error('SyncJobAddressesFromPremier: Failed', [
            'error' => $exception->getMessage(),
        ]);
    }

    public function backoff(): array
    {
        return [60, 120, 240];
    }
}
