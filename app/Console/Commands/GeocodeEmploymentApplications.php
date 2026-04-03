<?php

namespace App\Console\Commands;

use App\Models\EmploymentApplication;
use App\Services\GeocodingService;
use Illuminate\Console\Command;

class GeocodeEmploymentApplications extends Command
{
    protected $signature = 'applications:geocode {--force : Re-geocode already geocoded applications}';

    protected $description = 'Geocode employment applications that have a suburb but no coordinates';

    public function handle(GeocodingService $geocoding): int
    {
        $query = EmploymentApplication::query()
            ->whereNotNull('suburb')
            ->where('suburb', '!=', '');

        if (! $this->option('force')) {
            $query->whereNull('geocoded_at');
        }

        $total = $query->count();

        if ($total === 0) {
            $this->info('No applications to geocode.');

            return self::SUCCESS;
        }

        $this->info("Geocoding {$total} application(s)...");
        $bar = $this->output->createProgressBar($total);
        $success = 0;
        $failed = 0;

        $query->chunkById(50, function ($applications) use ($geocoding, $bar, &$success, &$failed) {
            foreach ($applications as $application) {
                $result = $geocoding->geocode($application->suburb);

                $application->update([
                    'latitude' => $result['latitude'] ?? null,
                    'longitude' => $result['longitude'] ?? null,
                    'geocoded_at' => now(),
                ]);

                $result ? $success++ : $failed++;
                $bar->advance();

                usleep(100_000); // 100ms delay between API calls
            }
        });

        $bar->finish();
        $this->newLine();
        $this->info("Done. Geocoded: {$success}, Failed: {$failed}");

        return self::SUCCESS;
    }
}
