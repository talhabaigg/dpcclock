<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class AuditLocationGlobal extends Command
{
    protected $signature = 'eh:audit-locations';
    protected $description = 'Audit Employment Hero locations to find which are set as global (available to all employees)';

    public function handle()
    {
        $apiKey = config('services.employment_hero.api_key');
        $baseUrl = config('services.employment_hero.base_url');
        $businessId = config('services.employment_hero.business_id');

        if (! $apiKey) {
            $this->error('PAYROLL_API_KEY is not configured.');
            return 1;
        }

        $this->info('Fetching locations from Employment Hero...');

        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':'),
        ])->get("{$baseUrl}/business/{$businessId}/location");

        if ($response->failed()) {
            $this->error('API request failed: ' . $response->status() . ' - ' . $response->body());
            return 1;
        }

        $locations = $response->json();

        if (! is_array($locations) || empty($locations)) {
            $this->warn('No locations returned from the API.');
            return 0;
        }

        $this->info("Total locations fetched: " . count($locations));
        $this->newLine();

        // Filter global locations
        $globalLocations = collect($locations)->filter(fn ($loc) => !empty($loc['isGlobal']));

        if ($globalLocations->isEmpty()) {
            $this->info('No locations have isGlobal set to true.');
            return 0;
        }

        $this->warn("Locations with isGlobal = true: " . $globalLocations->count());
        $this->newLine();

        $rows = $globalLocations->map(fn ($loc) => [
            $loc['id'] ?? '-',
            $loc['name'] ?? '-',
            $loc['parentId'] ?? '-',
            $loc['source'] ?? 'Not set',
            $loc['externalId'] ?? '-',
            $loc['state'] ?? '-',
            $loc['isGlobal'] ? 'YES' : 'NO',
        ])->toArray();

        $this->table(
            ['ID', 'Name', 'Parent ID', 'Source', 'External ID', 'State', 'isGlobal'],
            $rows
        );

        // Summary by source
        $this->newLine();
        $this->info('--- Summary by Source ---');
        $globalLocations->groupBy(fn ($loc) => $loc['source'] ?? 'Not set')
            ->each(function ($group, $source) {
                $this->line("  {$source}: {$group->count()} location(s)");
            });

        return 0;
    }
}
