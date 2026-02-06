<?php

namespace App\Services;

use App\Models\Requisition;

class POComparisonService
{
    protected PremierPurchaseOrderService $premierService;

    public function __construct()
    {
        $this->premierService = new PremierPurchaseOrderService;
    }

    /**
     * Compare local requisition with Premier PO
     * Returns structured comparison data
     */
    public function compare(Requisition $requisition, bool $skipDebugCalls = true): array
    {
        if (! $requisition->premier_po_id) {
            throw new \Exception('Requisition has not been synced with Premier');
        }

        // Load local line items
        $localLines = $requisition->lineItems->map(fn ($item) => [
            'id' => $item->id,
            'line_number' => $item->serial_number,
            'code' => $item->code,
            'description' => $item->description,
            'qty' => (float) $item->qty,
            'unit_cost' => (float) $item->unit_cost,
            'total_cost' => (float) $item->total_cost,
            'cost_code' => $item->cost_code,
            'price_list' => $item->price_list,
            'source' => 'local',
        ])->toArray();

        // Fetch Premier lines (uses cached data if available, skip API fallback for report performance)
        $premierLines = $this->premierService->getPurchaseOrderLines(
            $requisition->premier_po_id,
            forceRefresh: false,
            cacheOnly: $skipDebugCalls // When skipping debug calls (reports), also skip API fallback
        );
        $premierLines = $this->normalizePremierLines($premierLines);

        // Fetch invoices and invoice lines by PO number
        $poNumber = $requisition->po_number ? 'PO'.$requisition->po_number : null;
        $invoices = $poNumber ? $this->premierService->getInvoicesByPoNumber($poNumber) : [];
        $invoiceLines = $poNumber ? $this->premierService->getInvoiceLinesByPoNumber($poNumber) : [];
        $invoiceSummary = $this->summarizeInvoices($invoices);

        // Perform matching and comparison (now includes invoice matching)
        $comparisonResult = $this->matchAndCompare($localLines, $premierLines, $invoiceLines);

        // Calculate summary statistics
        $summary = $this->calculateSummary($comparisonResult);

        // Calculate invoice total from lines
        $invoiceTotal = array_sum(array_column($invoiceLines, 'total_cost'));

        // Build description comparison debug data
        $descriptionComparison = [];
        foreach ($localLines as $local) {
            $localDesc = $local['code']
                ? strtolower(trim($local['code'].'-'.($local['description'] ?? '')))
                : strtolower(trim($local['description'] ?? ''));

            $localWords = $this->extractSignificantWords($localDesc);
            $localUnitCost = (float) ($local['unit_cost'] ?? 0);
            $localTotalCost = (float) ($local['total_cost'] ?? 0);
            $localQty = (float) ($local['qty'] ?? 0);

            $invoiceMatches = [];
            foreach ($invoiceLines as $invLine) {
                $invDesc = strtolower(trim($invLine['line_description'] ?? ''));
                similar_text($localDesc, $invDesc, $similarPct);

                $invWords = $this->extractSignificantWords($invDesc);
                $wordPct = $this->calculateWordMatchScore($localWords, $invWords);

                // Check cost matches
                $invUnitCost = (float) ($invLine['unit_cost'] ?? 0);
                $invTotalCost = (float) ($invLine['total_cost'] ?? 0);
                $invQty = (float) ($invLine['qty'] ?? 0);

                $costMatch = null;
                if ($localTotalCost > 0 && abs($localTotalCost - $invTotalCost) < 0.01) {
                    $costMatch = 'exact_total';
                } elseif ($localUnitCost > 0 && abs($localUnitCost - $invUnitCost) < 0.001 && abs($localQty - $invQty) < 0.01) {
                    $costMatch = 'unit_qty';
                } elseif ($localTotalCost > 0 && abs($localTotalCost - $invTotalCost) <= $localTotalCost * 0.05) {
                    $costMatch = 'approx_total';
                }

                $invoiceMatches[] = [
                    'invoice_desc' => substr($invLine['line_description'] ?? '', 0, 40),
                    'similar_text' => round($similarPct, 1),
                    'word_match' => round($wordPct, 1),
                    'best_desc' => round(max($similarPct, $wordPct), 1),
                    'cost_match' => $costMatch,
                    'inv_total' => $invTotalCost,
                ];
            }

            $descriptionComparison[] = [
                'local_desc' => substr($localDesc, 0, 40),
                'local_words' => $localWords,
                'local_total' => $localTotalCost,
                'invoice_matches' => $invoiceMatches,
            ];
        }

        // Build debug data - skip API calls if requested (for report performance)
        $debug = [
            'local_count' => count($localLines),
            'premier_count' => count($premierLines),
            'invoice_lines_count' => count($invoiceLines),
            'local_sample' => array_values(array_slice($localLines, 0, 2)),
            'premier_sample' => array_values(array_slice($premierLines, 0, 2)),
            'invoice_lines_sample' => array_values(array_slice($invoiceLines, 0, 5)),
            'expected_po_id' => $requisition->premier_po_id,
            'invoice_query' => [
                'method' => 'po_number_lookup',
                'po_number' => $poNumber,
                'invoices_found' => count($invoices),
            ],
            'description_comparison' => $descriptionComparison,
        ];

        // Only make additional API calls for detailed debug if not skipped
        if (! $skipDebugCalls) {
            $debug['premier_raw_sample'] = $this->getRawPremierSample($requisition->premier_po_id);
            $debug['premier_deleted_lines'] = $this->getDeletedLines($requisition->premier_po_id);
        }

        return [
            'comparison' => $comparisonResult,
            'summary' => $summary,
            'local_total' => array_sum(array_column($localLines, 'total_cost')),
            'premier_total' => array_sum(array_column($premierLines, 'total_cost')),
            'invoice_total' => $invoiceTotal,
            'invoices' => $invoiceSummary,
            'fetched_at' => now()->toIso8601String(),
            'debug' => $debug,
        ];
    }

    /**
     * Summarize invoice data for a PO
     */
    protected function summarizeInvoices(array $invoices): array
    {
        if (empty($invoices)) {
            return [
                'has_invoices' => false,
                'count' => 0,
                'total' => 0,
                'invoices' => [],
            ];
        }

        $invoiceList = array_map(fn ($inv) => [
            'invoice_number' => $inv['InvoiceNumber'] ?? null,
            'invoice_date' => $inv['InvoiceDate'] ?? null,
            'total' => (float) ($inv['InvoiceTotal'] ?? 0),
            'status' => $inv['InvoiceStatus'] ?? null,
            'approval_status' => $inv['ApprovalStatus'] ?? null,
        ], $invoices);

        return [
            'has_invoices' => true,
            'count' => count($invoices),
            'total' => array_sum(array_column($invoiceList, 'total')),
            'invoices' => $invoiceList,
        ];
    }

    /**
     * Get ALL raw Premier items for debugging (before normalization)
     */
    protected function getRawPremierSample(string $premierPoId): ?array
    {
        try {
            $authService = new PremierAuthenticationService;
            $token = $authService->getAccessToken();
            $baseUrl = env('PREMIER_SWAGGER_API_URL');

            $response = \Illuminate\Support\Facades\Http::withToken($token)
                ->acceptJson()
                ->get("{$baseUrl}/api/PurchaseOrder/GetPurchaseOrderLines", [
                    'purchaseOrderId' => $premierPoId,
                    'pageSize' => 1000,
                ]);

            $data = $response->json('Data');

            // Return ALL raw items
            if (is_array($data) && isset($data[0])) {
                if (is_array($data[0]) && isset($data[0][0])) {
                    // Nested array [[item1, item2]] - return all items
                    return [
                        'total_count' => count($data[0]),
                        'items' => $data[0],
                    ];
                }
                // Check if data[0] is an item itself or array of items
                if (isset($data[0]['PurchaseOrderLineId'])) {
                    // Flat array [item1, item2]
                    return [
                        'total_count' => count($data),
                        'items' => $data,
                    ];
                }

                // Nested but first element is array
                return [
                    'total_count' => count($data[0]),
                    'items' => $data[0],
                ];
            }

            return ['raw_data' => $data, 'total_count' => 0];
        } catch (\Exception $e) {
            return ['error' => $e->getMessage()];
        }
    }

    /**
     * Get deleted line IDs from Premier
     */
    protected function getDeletedLines(string $premierPoId): array
    {
        try {
            return $this->premierService->getDeletedPurchaseOrderLineIds($premierPoId);
        } catch (\Exception $e) {
            return ['error' => $e->getMessage()];
        }
    }

    /**
     * Normalize Premier API response to consistent format
     */
    protected function normalizePremierLines(array $premierLines): array
    {
        return array_map(fn ($line) => [
            'id' => $line['PurchaseOrderLineId'] ?? null,
            'line_number' => $line['Line'] ?? null,
            'code' => null, // Premier uses ItemId (UUID), not code
            'has_invoice' => ($line['InvoiceBalance'] ?? 0) > 0,
            'invoice_balance' => (float) ($line['InvoiceBalance'] ?? 0),
            'description' => $line['LineDescription'] ?? '',
            'qty' => (float) ($line['Quantity'] ?? 0),
            'unit_cost' => (float) ($line['UnitCost'] ?? 0),
            'total_cost' => (float) ($line['Amount'] ?? 0),
            'cost_code' => null, // Premier uses CostItemId (UUID)
            'source' => 'premier',
        ], $premierLines);
    }

    /**
     * Match local lines to Premier lines and invoice lines, identify differences
     */
    protected function matchAndCompare(array $localLines, array $premierLines, array $invoiceLines = []): array
    {
        $result = [];
        $matchedPremierIndices = [];
        $matchedInvoiceIndices = [];

        // Match local lines to Premier lines
        foreach ($localLines as $localLine) {
            $bestMatch = $this->findBestMatch($localLine, $premierLines, $matchedPremierIndices);
            $premierLine = null;

            if ($bestMatch !== null) {
                $matchedPremierIndices[] = $bestMatch['index'];
                $premierLine = $premierLines[$bestMatch['index']];
            }

            // Find matching invoice line based on description
            $invoiceLine = $this->findMatchingInvoiceLine($localLine, $premierLine, $invoiceLines, $matchedInvoiceIndices);
            if ($invoiceLine !== null) {
                $matchedInvoiceIndices[] = $invoiceLine['matched_index'];
                unset($invoiceLine['matched_index']);
            }

            if ($premierLine !== null) {
                $result[] = [
                    'status' => $this->determineStatus($localLine, $premierLine),
                    'local' => $localLine,
                    'premier' => $premierLine,
                    'invoice' => $invoiceLine,
                    'variances' => $this->calculateVariances($localLine, $premierLine),
                    'match_score' => $bestMatch['score'],
                ];
            } else {
                // Local line not found in Premier (removed)
                $result[] = [
                    'status' => 'removed',
                    'local' => $localLine,
                    'premier' => null,
                    'invoice' => $invoiceLine,
                    'variances' => null,
                    'match_score' => 0,
                ];
            }
        }

        // Find Premier lines not matched (added in Premier)
        foreach ($premierLines as $index => $premierLine) {
            if (! in_array($index, $matchedPremierIndices)) {
                // Try to find invoice for this added premier line
                $invoiceLine = $this->findMatchingInvoiceLine(null, $premierLine, $invoiceLines, $matchedInvoiceIndices);
                if ($invoiceLine !== null) {
                    $matchedInvoiceIndices[] = $invoiceLine['matched_index'];
                    unset($invoiceLine['matched_index']);
                }

                $result[] = [
                    'status' => 'added',
                    'local' => null,
                    'premier' => $premierLine,
                    'invoice' => $invoiceLine,
                    'variances' => null,
                    'match_score' => 0,
                ];
            }
        }

        return $result;
    }

    /**
     * Find matching invoice line for a local/premier line
     * Uses multiple matching strategies: description, word-based, and cost-based
     */
    protected function findMatchingInvoiceLine(?array $localLine, ?array $premierLine, array $invoiceLines, array $excludeIndices): ?array
    {
        if (empty($invoiceLines)) {
            return null;
        }

        // Get reference values from local or premier
        $refLine = $localLine ?? $premierLine;
        if (! $refLine) {
            return null;
        }

        // Build search description
        $searchDesc = '';
        if ($localLine) {
            $searchDesc = $localLine['code']
                ? strtolower(trim($localLine['code'].'-'.($localLine['description'] ?? '')))
                : strtolower(trim($localLine['description'] ?? ''));
        } elseif ($premierLine) {
            $searchDesc = strtolower(trim($premierLine['description'] ?? ''));
        }

        // Extract significant words (3+ chars, not numbers)
        $searchWords = ! empty($searchDesc) ? $this->extractSignificantWords($searchDesc) : [];

        // Get cost values for cost-based matching
        $refUnitCost = (float) ($refLine['unit_cost'] ?? 0);
        $refTotalCost = (float) ($refLine['total_cost'] ?? 0);
        $refQty = (float) ($refLine['qty'] ?? 0);

        $bestScore = 0;
        $bestIndex = null;
        $matchMethod = null;

        foreach ($invoiceLines as $index => $invLine) {
            if (in_array($index, $excludeIndices)) {
                continue;
            }

            $score = 0;
            $method = 'none';

            // Strategy 1: Description-based matching
            $invDesc = strtolower(trim($invLine['line_description'] ?? ''));
            if (! empty($searchDesc) && ! empty($invDesc)) {
                // Calculate similar_text score
                similar_text($searchDesc, $invDesc, $similarTextPercent);

                // Calculate word match score
                $invWords = $this->extractSignificantWords($invDesc);
                $wordMatchScore = $this->calculateWordMatchScore($searchWords, $invWords);

                // Use the better of the two scores
                $descScore = max($similarTextPercent, $wordMatchScore);
                if ($descScore > $score) {
                    $score = $descScore;
                    $method = 'description';
                }
            }

            // Strategy 2: Cost-based matching (fallback when description match is weak)
            // Only use if description score is below 30%
            if ($score < 30) {
                $invUnitCost = (float) ($invLine['unit_cost'] ?? 0);
                $invTotalCost = (float) ($invLine['total_cost'] ?? 0);
                $invQty = (float) ($invLine['qty'] ?? 0);

                // Check for exact total cost match (within 1 cent)
                if ($refTotalCost > 0 && abs($refTotalCost - $invTotalCost) < 0.01) {
                    $score = 80; // High confidence for exact total match
                    $method = 'total_cost';
                }
                // Check for exact unit cost + qty match
                elseif ($refUnitCost > 0 && abs($refUnitCost - $invUnitCost) < 0.001 && abs($refQty - $invQty) < 0.01) {
                    $score = 75; // High confidence for exact unit cost + qty match
                    $method = 'unit_cost_qty';
                }
                // Check for close total cost match (within 5%)
                elseif ($refTotalCost > 0) {
                    $tolerance = $refTotalCost * 0.05; // 5% tolerance
                    if (abs($refTotalCost - $invTotalCost) <= $tolerance) {
                        $score = max($score, 50); // Moderate confidence
                        $method = 'total_cost_approx';
                    }
                }
            }

            if ($score > $bestScore && $score >= 30) { // 30% threshold
                $bestScore = $score;
                $bestIndex = $index;
                $matchMethod = $method;
            }
        }

        if ($bestIndex === null) {
            return null;
        }

        $matched = $invoiceLines[$bestIndex];

        return [
            'matched_index' => $bestIndex,
            'description' => $matched['line_description'],
            'qty' => $matched['qty'],
            'unit_cost' => $matched['unit_cost'],
            'total_cost' => $matched['total_cost'],
            'invoice_number' => $matched['invoice_number'] ?? null,
            'match_method' => $matchMethod,
        ];
    }

    /**
     * Extract significant words from a description (3+ chars, non-numeric)
     */
    protected function extractSignificantWords(string $text): array
    {
        // Remove special chars, split by spaces/hyphens
        $words = preg_split('/[\s\-\/\(\)]+/', $text);
        $significant = [];

        foreach ($words as $word) {
            $word = preg_replace('/[^a-z0-9]/', '', $word);
            // Keep words that are 3+ chars and not purely numeric
            if (strlen($word) >= 3 && ! ctype_digit($word)) {
                $significant[] = $word;
            }
        }

        return array_unique($significant);
    }

    /**
     * Calculate percentage of matching words between two word lists
     */
    protected function calculateWordMatchScore(array $words1, array $words2): float
    {
        if (empty($words1) || empty($words2)) {
            return 0;
        }

        $matches = 0;
        $totalWords = count($words1);

        foreach ($words1 as $word1) {
            foreach ($words2 as $word2) {
                // Exact match or one contains the other (for trimtex vs trim-tex)
                if ($word1 === $word2 || strpos($word1, $word2) !== false || strpos($word2, $word1) !== false) {
                    $matches++;
                    break;
                }
                // Fuzzy match for very similar words (levenshtein distance)
                if (strlen($word1) >= 4 && strlen($word2) >= 4) {
                    $maxLen = max(strlen($word1), strlen($word2));
                    $distance = levenshtein($word1, $word2);
                    if ($distance <= 2 && ($distance / $maxLen) < 0.3) {
                        $matches++;
                        break;
                    }
                }
            }
        }

        // Score based on % of words matched from the local description
        return ($matches / $totalWords) * 100;
    }

    /**
     * Find best matching Premier line for a local line
     */
    protected function findBestMatch(array $localLine, array $premierLines, array $excludeIndices): ?array
    {
        $bestScore = 0;
        $bestIndex = null;

        foreach ($premierLines as $index => $premierLine) {
            if (in_array($index, $excludeIndices)) {
                continue;
            }

            $score = $this->calculateMatchScore($localLine, $premierLine);

            if ($score > $bestScore && $score >= 0.6) { // 60% threshold
                $bestScore = $score;
                $bestIndex = $index;
            }
        }

        return $bestIndex !== null ? ['index' => $bestIndex, 'score' => $bestScore] : null;
    }

    /**
     * Calculate similarity score between two lines (0-1)
     */
    protected function calculateMatchScore(array $local, array $premier): float
    {
        $score = 0;

        // Line number match is the strongest indicator
        $lineNumberMatch = $local['line_number'] && $premier['line_number']
            && $local['line_number'] == $premier['line_number'];

        if ($lineNumberMatch) {
            // Line numbers match - this is very reliable, give high base score
            $score = 0.5;
        }

        // Build local description the same way it was sent to Premier (CODE-Description)
        $localDesc = $local['code']
            ? strtolower(trim($local['code'].'-'.($local['description'] ?? '')))
            : strtolower(trim($local['description'] ?? ''));
        $premierDesc = strtolower(trim($premier['description'] ?? ''));

        if (! empty($localDesc) && ! empty($premierDesc)) {
            similar_text($localDesc, $premierDesc, $descPercent);
            // If line numbers match, description similarity adds up to 0.5 more
            // If line numbers don't match, description similarity can give up to 0.7
            $descWeight = $lineNumberMatch ? 0.5 : 0.7;
            $score += ($descPercent / 100) * $descWeight;
        }

        return $score;
    }

    /**
     * Determine status of a matched pair
     */
    protected function determineStatus(array $local, array $premier): string
    {
        $hasQtyChange = abs($local['qty'] - $premier['qty']) > 0.001;
        $hasPriceChange = abs($local['unit_cost'] - $premier['unit_cost']) > 0.001;

        if ($hasQtyChange || $hasPriceChange) {
            return 'modified';
        }

        return 'unchanged';
    }

    /**
     * Calculate variances between local and Premier
     */
    protected function calculateVariances(array $local, array $premier): array
    {
        return [
            'qty' => [
                'local' => $local['qty'],
                'premier' => $premier['qty'],
                'difference' => $premier['qty'] - $local['qty'],
                'has_change' => abs($local['qty'] - $premier['qty']) > 0.001,
            ],
            'unit_cost' => [
                'local' => $local['unit_cost'],
                'premier' => $premier['unit_cost'],
                'difference' => $premier['unit_cost'] - $local['unit_cost'],
                'has_change' => abs($local['unit_cost'] - $premier['unit_cost']) > 0.001,
            ],
            'total_cost' => [
                'local' => $local['total_cost'],
                'premier' => $premier['total_cost'],
                'difference' => $premier['total_cost'] - $local['total_cost'],
                'has_change' => abs($local['total_cost'] - $premier['total_cost']) > 0.01,
            ],
        ];
    }

    /**
     * Calculate summary statistics
     */
    protected function calculateSummary(array $comparison): array
    {
        $unchanged = 0;
        $modified = 0;
        $added = 0;
        $removed = 0;
        $totalVariance = 0;

        foreach ($comparison as $item) {
            switch ($item['status']) {
                case 'unchanged':
                    $unchanged++;
                    break;
                case 'modified':
                    $modified++;
                    $totalVariance += $item['variances']['total_cost']['difference'];
                    break;
                case 'added':
                    $added++;
                    $totalVariance += $item['premier']['total_cost'];
                    break;
                case 'removed':
                    $removed++;
                    $totalVariance -= $item['local']['total_cost'];
                    break;
            }
        }

        return [
            'unchanged_count' => $unchanged,
            'modified_count' => $modified,
            'added_count' => $added,
            'removed_count' => $removed,
            'total_items' => count($comparison),
            'total_variance' => $totalVariance,
            'has_discrepancies' => ($modified + $added + $removed) > 0,
        ];
    }

    /**
     * Parse a numeric value from a string (handles currency symbols, commas, etc.)
     */
    protected function parseNumericValue(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        // Remove currency symbols, spaces, and commas, then try to parse
        $cleaned = preg_replace('/[^\d.\-]/', '', (string) $value);

        if ($cleaned === '' || $cleaned === '-') {
            return null;
        }

        return (float) $cleaned;
    }
}
