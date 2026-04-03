<?php

namespace App\Jobs;

use App\Models\EmploymentApplication;
use App\Services\GeocodingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class GeocodeEmploymentApplication implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [10, 30, 60];

    public function __construct(
        public int $applicationId,
    ) {}

    public function handle(GeocodingService $geocoding): void
    {
        $application = EmploymentApplication::find($this->applicationId);

        if (! $application || (! $application->suburb && ! $application->address)) {
            return;
        }

        // Use full address if available, fall back to suburb
        $addressToGeocode = $application->address ?: $application->suburb;
        $result = $geocoding->geocode($addressToGeocode);

        if ($result) {
            $application->update([
                'latitude' => $result['latitude'],
                'longitude' => $result['longitude'],
                'geocoded_at' => now(),
            ]);
        }
    }
}
