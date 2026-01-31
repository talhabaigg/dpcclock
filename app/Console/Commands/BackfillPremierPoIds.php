<?php

namespace App\Console\Commands;

use App\Models\PremierPoHeader;
use App\Models\Requisition;
use App\Services\PremierAuthenticationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BackfillPremierPoIds extends Command
{
    protected $signature = 'premier:backfill-po-ids
                            {--dry-run : Show what would be updated without making changes}
                            {--limit= : Limit the number of requisitions to process}
                            {--max-pages=20 : Maximum number of API pages to fetch}';

    protected $description = 'Fetch Premier PO headers and link them to requisitions by matching PO numbers';

    protected string $baseUrl;

    public function handle(): int
    {
        $this->baseUrl = env('PREMIER_SWAGGER_API_URL');
        $dryRun = $this->option('dry-run');
        $limit = $this->option('limit');

        if ($dryRun) {
            $this->info('DRY RUN MODE - No changes will be made');
        }

        // Step 1: Fetch all PO headers from Premier
        $this->info('Fetching PO headers from Premier API...');
        $poHeaders = $this->fetchAllPremierPoHeaders();

        if (empty($poHeaders)) {
            $this->error('No PO headers returned from Premier API');
            return 1;
        }

        $this->info("Found " . count($poHeaders) . " POs in Premier");

        // Step 2: Build a lookup map of PO Number -> Premier PO ID
        $poNumberToId = [];
        foreach ($poHeaders as $header) {
            $poNumber = $header['PONumber'] ?? null;
            $premierId = $header['PurchaseOrderId'] ?? null;

            if ($poNumber && $premierId) {
                // Strip 'PO' prefix if present for matching
                $cleanPoNumber = preg_replace('/^PO/i', '', $poNumber);
                $poNumberToId[$cleanPoNumber] = [
                    'premier_po_id' => $premierId,
                    'raw' => $header,
                ];
            }
        }

        $this->info("Built lookup map with " . count($poNumberToId) . " PO numbers");

        // Step 3: Find requisitions without premier_po_id but with po_number
        $query = Requisition::whereNull('premier_po_id')
            ->whereNotNull('po_number');

        if ($limit) {
            $query->limit((int) $limit);
        }

        $requisitions = $query->get();

        $this->info("Found " . $requisitions->count() . " requisitions without Premier PO ID");

        if ($requisitions->isEmpty()) {
            $this->info('No requisitions to update');
            return 0;
        }

        // Step 4: Match and update
        $matched = 0;
        $notFound = 0;

        $this->output->progressStart($requisitions->count());

        foreach ($requisitions as $requisition) {
            $poNumber = $requisition->po_number;

            // Try to find in lookup
            if (isset($poNumberToId[$poNumber])) {
                $premierData = $poNumberToId[$poNumber];

                if (!$dryRun) {
                    // Update requisition with Premier PO ID
                    $requisition->premier_po_id = $premierData['premier_po_id'];
                    $requisition->save();

                    // Also store the header in our cache table
                    $this->storeHeader($premierData['premier_po_id'], $premierData['raw'], $requisition->id);
                }

                $matched++;
                $this->output->progressAdvance();
            } else {
                $notFound++;
                $this->output->progressAdvance();

                Log::info('BackfillPremierPoIds: No Premier PO found', [
                    'requisition_id' => $requisition->id,
                    'po_number' => $poNumber,
                ]);
            }
        }

        $this->output->progressFinish();

        $this->newLine();
        $this->info("Results:");
        $this->info("  - Matched and " . ($dryRun ? "would update" : "updated") . ": {$matched}");
        $this->info("  - Not found in Premier: {$notFound}");

        if ($dryRun && $matched > 0) {
            $this->newLine();
            $this->warn("Run without --dry-run to apply changes");
        }

        return 0;
    }

    protected function fetchAllPremierPoHeaders(): array
    {
        try {
            $authService = new PremierAuthenticationService();
            $token = $authService->getAccessToken();

            // Fetch all POs - may need pagination for large datasets
            $allHeaders = [];
            $seenPoIds = []; // Track unique PO IDs to prevent duplicates
            $page = 1;
            $pageSize = 1000; // Max allowed by Premier API
            $maxPages = (int) $this->option('max-pages');

            do {
                $this->info("  Fetching page {$page}...");

                $response = Http::withToken($token)
                    ->acceptJson()
                    ->timeout(120)
                    ->get("{$this->baseUrl}/api/PurchaseOrder/GetPurchaseOrders", [
                        'parameter.companyId' => '3341c7c6-2abb-49e1-8a59-839d1bcff972',
                        'parameter.pageSize' => $pageSize,
                        'parameter.pageNumber' => $page,
                    ]);

                if ($response->failed()) {
                    $this->error("API request failed: " . $response->body());
                    break;
                }

                $data = $response->json('Data');

                // Handle nested response structure
                $items = [];
                if (is_array($data)) {
                    if (isset($data[0]) && is_array($data[0])) {
                        if (isset($data[0][0])) {
                            // Nested: [[item1, item2, ...]]
                            $items = $data[0];
                        } elseif (isset($data[0]['PurchaseOrderId'])) {
                            // Flat: [item1, item2, ...]
                            $items = $data;
                        }
                    } elseif (isset($data['PurchaseOrderId'])) {
                        // Single item
                        $items = [$data];
                    }
                }

                if (empty($items)) {
                    $this->info("  No more items returned, stopping.");
                    break;
                }

                // Deduplicate by PurchaseOrderId
                $newItems = 0;
                $duplicates = 0;
                foreach ($items as $item) {
                    $poId = $item['PurchaseOrderId'] ?? null;
                    if ($poId && !isset($seenPoIds[$poId])) {
                        $seenPoIds[$poId] = true;
                        $allHeaders[] = $item;
                        $newItems++;
                    } else {
                        $duplicates++;
                    }
                }

                $this->info("  Page {$page}: " . count($items) . " items ({$newItems} new, {$duplicates} duplicates) - Total unique: " . count($allHeaders));

                // If we got all duplicates, the API might be returning the same data
                if ($newItems === 0) {
                    $this->warn("  All items on this page were duplicates, stopping pagination.");
                    break;
                }

                // If we got less than pageSize, we're done
                if (count($items) < $pageSize) {
                    $this->info("  Received fewer items than page size, reached end of data.");
                    break;
                }

                // Check max pages limit
                if ($page >= $maxPages) {
                    $this->warn("  Reached max pages limit ({$maxPages}). Use --max-pages to increase if needed.");
                    break;
                }

                $page++;

            } while (true);

            return $allHeaders;

        } catch (\Exception $e) {
            $this->error("Exception fetching PO headers: " . $e->getMessage());
            Log::error('BackfillPremierPoIds: Failed to fetch headers', [
                'error' => $e->getMessage(),
            ]);
            return [];
        }
    }

    protected function storeHeader(string $premierPoId, array $headerData, int $requisitionId): void
    {
        $syncedAt = now();

        PremierPoHeader::updateOrCreate(
            ['premier_po_id' => $premierPoId],
            [
                'requisition_id' => $requisitionId,
                'po_number' => $headerData['PONumber'] ?? null,
                'vendor_id' => $headerData['VendorId'] ?? null,
                'vendor_code' => $headerData['VendorCode'] ?? null,
                'vendor_name' => $headerData['VendorName'] ?? null,
                'job_id' => $headerData['JobId'] ?? null,
                'job_number' => $headerData['JobNumber'] ?? null,
                'po_date' => isset($headerData['PODate']) ? \Carbon\Carbon::parse($headerData['PODate']) : null,
                'required_date' => isset($headerData['RequiredDate']) ? \Carbon\Carbon::parse($headerData['RequiredDate']) : null,
                'total_amount' => (float) ($headerData['Total'] ?? $headerData['Amount'] ?? 0),
                'invoiced_amount' => (float) ($headerData['InvoicedAmount'] ?? $headerData['InvoiceBalance'] ?? 0),
                'status' => $headerData['Status'] ?? $headerData['POStatus'] ?? null,
                'approval_status' => $headerData['ApprovalStatus'] ?? null,
                'description' => $headerData['Description'] ?? null,
                'raw_data' => $headerData,
                'synced_at' => $syncedAt,
            ]
        );
    }
}
