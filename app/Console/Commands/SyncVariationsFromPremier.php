<?php

namespace App\Console\Commands;

use App\Jobs\LoadVariationsFromPremierJob;
use App\Models\Location;
use Illuminate\Console\Command;

class SyncVariationsFromPremier extends Command
{
    protected $signature = 'premier:sync-variations
                            {--location= : Sync a specific location ID}';

    protected $description = 'Sync variations from Premier Swagger API for all jobs (locations)';

    public function handle(): int
    {
        if ($locationId = $this->option('location')) {
            return $this->syncSingle((int) $locationId);
        }

        return $this->syncAll();
    }

    protected function syncSingle(int $locationId): int
    {
        $location = Location::find($locationId);

        if (! $location) {
            $this->error("Location {$locationId} not found");

            return 1;
        }

        if (! $location->external_id) {
            $this->error("Location {$locationId} has no Premier external ID");

            return 1;
        }

        LoadVariationsFromPremierJob::dispatch($location);
        $this->info("Queued variation sync for location: {$location->name} (ID: {$locationId})");

        return 0;
    }

    protected function syncAll(): int
    {
        $companyIds = ['1198645', '1249093']; // GREEN, SWCP (excluding SWC)

        $locations = Location::whereNotNull('external_id')
            ->where('external_id', '!=', '')
            ->whereIn('eh_parent_id', $companyIds)
            ->get();

        if ($locations->isEmpty()) {
            $this->warn('No locations with Premier external IDs found');

            return 0;
        }

        $this->info("Queueing variation sync for {$locations->count()} locations...");

        foreach ($locations as $location) {
            LoadVariationsFromPremierJob::dispatch($location);
            $this->line(" - Queued: {$location->name} (external_id: {$location->external_id})");
        }

        $this->info("Queued {$locations->count()} variation sync jobs");

        return 0;
    }
}
