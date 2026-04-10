<?php

namespace App\Console\Commands;

use App\Models\PremierVendor;
use App\Services\PremierAuthenticationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SyncPremierVendors extends Command
{
    protected $signature = 'premier:sync-vendors';

    protected $description = 'Sync vendors from Premier API';

    private const COMPANY_ID = '3341c7c6-2abb-49e1-8a59-839d1bcff972';

    public function handle(): int
    {
        $this->info('Syncing vendors from Premier...');

        $authService = new PremierAuthenticationService;
        $token = $authService->getAccessToken();
        $baseUrl = config('premier.swagger_api.base_url');

        $page = 1;
        $totalSynced = 0;

        do {
            $response = Http::withToken($token)
                ->acceptJson()
                ->timeout(60)
                ->get("{$baseUrl}/api/Vendor/GetVendors", [
                    'parameter.companyId' => self::COMPANY_ID,
                    'parameter.pageSize' => 500,
                    'parameter.pageNumber' => $page,
                    'parameter.status' => 'Active',
                ]);

            if ($response->failed()) {
                $this->error("API request failed (HTTP {$response->status()}): {$response->body()}");
                Log::error('SyncPremierVendors: API failed', ['status' => $response->status(), 'body' => $response->body()]);

                return self::FAILURE;
            }

            $vendors = $response->json('Data') ?? [];

            if (empty($vendors)) {
                break;
            }

            // Log first row keys on first page to help verify field mapping
            if ($page === 1) {
                $this->info('Sample row keys: ' . implode(', ', array_keys($vendors[0] ?? [])));
            }

            foreach ($vendors as $vendor) {
                $vendorId = $vendor['VendorId'] ?? $vendor['Id'] ?? null;
                $code = $vendor['VendorCode'] ?? $vendor['Code'] ?? null;
                $name = $vendor['VendorName'] ?? $vendor['Name'] ?? null;
                $subledgerId = $vendor['APSubledgerId'] ?? $vendor['SubledgerId'] ?? null;

                if (! $vendorId || ! $code) {
                    continue;
                }

                PremierVendor::updateOrCreate(
                    ['premier_vendor_id' => $vendorId],
                    ['code' => $code, 'name' => $name ?? $code, 'ap_subledger_id' => $subledgerId]
                );

                $totalSynced++;
            }

            $this->info("Page {$page}: processed " . count($vendors) . ' vendors');
            $page++;

        } while (count($vendors) >= 500);

        $this->info("Sync complete. {$totalSynced} vendors synced.");

        return self::SUCCESS;
    }
}
