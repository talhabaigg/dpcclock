<?php

namespace App\Console\Commands;

use App\Models\PremierDivision;
use App\Services\PremierAuthenticationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SyncPremierDivisions extends Command
{
    protected $signature = 'premier:sync-divisions';

    protected $description = 'Sync divisions from Premier API';

    private const COMPANY_ID = '3341c7c6-2abb-49e1-8a59-839d1bcff972';

    public function handle(): int
    {
        $this->info('Syncing divisions from Premier...');

        $authService = new PremierAuthenticationService;
        $token = $authService->getAccessToken();
        $baseUrl = config('premier.swagger_api.base_url');

        $page = 1;
        $totalSynced = 0;

        do {
            $response = Http::withToken($token)
                ->acceptJson()
                ->timeout(60)
                ->get("{$baseUrl}/api/GL/GetDivisions", [
                    'parameter.companyId' => self::COMPANY_ID,
                    'parameter.pageSize' => 500,
                    'parameter.pageNumber' => $page,
                    'parameter.status' => 'Active',
                ]);

            if ($response->failed()) {
                $this->error("API request failed (HTTP {$response->status()}): {$response->body()}");
                Log::error('SyncPremierDivisions: API failed', ['status' => $response->status(), 'body' => $response->body()]);

                return self::FAILURE;
            }

            $divisions = $response->json('Data') ?? [];

            if (empty($divisions)) {
                break;
            }

            // Log first row keys on first page to help verify field mapping
            if ($page === 1 && ! empty($divisions[0])) {
                $this->info('Sample row keys: ' . implode(', ', array_keys($divisions[0])));
                $this->info('Sample row: ' . json_encode($divisions[0]));
            }

            foreach ($divisions as $division) {
                $divisionId = $division['DivisionId'] ?? $division['Id'] ?? null;
                $code = $division['DivisionCode'] ?? $division['Code'] ?? null;
                $description = $division['DivisionName'] ?? $division['Description'] ?? $division['Name'] ?? null;

                if (! $divisionId) {
                    continue;
                }

                PremierDivision::updateOrCreate(
                    ['premier_division_id' => $divisionId],
                    ['code' => $code ?? '', 'description' => $description]
                );

                $totalSynced++;
            }

            $this->info("Page {$page}: processed " . count($divisions) . ' divisions');
            $page++;

        } while (count($divisions) >= 500);

        $this->info("Sync complete. {$totalSynced} divisions synced.");

        // Display all divisions for reference
        $this->table(
            ['ID', 'Premier Division ID', 'Code', 'Description'],
            PremierDivision::all(['id', 'premier_division_id', 'code', 'description'])->toArray()
        );

        return self::SUCCESS;
    }
}
