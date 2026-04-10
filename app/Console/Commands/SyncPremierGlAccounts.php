<?php

namespace App\Console\Commands;

use App\Models\PremierGlAccount;
use App\Services\PremierAuthenticationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SyncPremierGlAccounts extends Command
{
    protected $signature = 'premier:sync-gl-accounts';

    protected $description = 'Sync GL accounts from Premier API';

    private const COMPANY_ID = '3341c7c6-2abb-49e1-8a59-839d1bcff972';

    public function handle(): int
    {
        $this->info('Syncing GL accounts from Premier...');

        $authService = new PremierAuthenticationService;
        $token = $authService->getAccessToken();
        $baseUrl = config('premier.swagger_api.base_url');

        $page = 1;
        $totalSynced = 0;

        do {
            $response = Http::withToken($token)
                ->acceptJson()
                ->timeout(60)
                ->get("{$baseUrl}/api/GL/GetAccounts", [
                    'parameter.companyId' => self::COMPANY_ID,
                    'parameter.pageSize' => 500,
                    'parameter.pageNumber' => $page,
                    'parameter.status' => 'Active',
                ]);

            if ($response->failed()) {
                $this->error("API request failed (HTTP {$response->status()}): {$response->body()}");
                Log::error('SyncPremierGlAccounts: API failed', ['status' => $response->status(), 'body' => $response->body()]);

                return self::FAILURE;
            }

            $accounts = $response->json('Data') ?? [];

            if (empty($accounts)) {
                break;
            }

            // Log first row keys on first page to help verify field mapping
            if ($page === 1 && ! empty($accounts[0])) {
                $this->info('Sample row keys: ' . implode(', ', array_keys($accounts[0])));
            }

            foreach ($accounts as $account) {
                $accountId = $account['AccountId'] ?? $account['Id'] ?? null;
                $accountNumber = $account['AccountNumber'] ?? $account['Number'] ?? null;
                $description = $account['Description'] ?? $account['AccountName'] ?? $account['Name'] ?? null;

                if (! $accountId || ! $accountNumber) {
                    continue;
                }

                PremierGlAccount::updateOrCreate(
                    ['premier_account_id' => $accountId],
                    ['account_number' => $accountNumber, 'description' => $description]
                );

                $totalSynced++;
            }

            $this->info("Page {$page}: processed " . count($accounts) . ' accounts');
            $page++;

        } while (count($accounts) >= 500);

        $this->info("Sync complete. {$totalSynced} GL accounts synced.");

        return self::SUCCESS;
    }
}
