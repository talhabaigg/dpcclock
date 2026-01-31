<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class POInsightsService
{
    private string $apiKey;
    private string $model;

    public function __construct()
    {
        $this->apiKey = config('services.openai.api_key') ?: env('OPENAI_API_KEY') ?: '';
        $this->model = env('OPENAI_CHAT_MODEL', 'gpt-4o');
    }

    /**
     * Generate AI insights for PO comparison report data
     */
    public function generateInsights(array $summaryData): array
    {
        if (!$this->apiKey) {
            return [
                'success' => false,
                'error' => 'OpenAI API key not configured',
                'insights' => null,
            ];
        }

        // Create a cache key based on the data
        $cacheKey = 'po_insights_' . md5(json_encode($summaryData));

        // Check cache first (insights valid for 30 minutes)
        $cached = Cache::get($cacheKey);
        if ($cached) {
            return [
                'success' => true,
                'insights' => $cached,
                'cached' => true,
            ];
        }

        $prompt = $this->buildPrompt($summaryData);

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(60)->post('https://api.openai.com/v1/chat/completions', [
                'model' => $this->model,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => $this->getSystemPrompt(),
                    ],
                    [
                        'role' => 'user',
                        'content' => $prompt,
                    ],
                ],
                'temperature' => 0.7,
                'max_tokens' => 2000,
            ]);

            if ($response->failed()) {
                Log::error('OpenAI API request failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return [
                    'success' => false,
                    'error' => 'Failed to generate insights: ' . $response->body(),
                    'insights' => null,
                ];
            }

            $content = $response->json('choices.0.message.content');

            // Parse the structured response
            $insights = $this->parseInsights($content);

            // Cache the result
            Cache::put($cacheKey, $insights, now()->addMinutes(30));

            return [
                'success' => true,
                'insights' => $insights,
                'cached' => false,
            ];

        } catch (\Exception $e) {
            Log::error('OpenAI API exception', [
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'Failed to generate insights: ' . $e->getMessage(),
                'insights' => null,
            ];
        }
    }

    /**
     * Get the system prompt for the AI
     */
    private function getSystemPrompt(): string
    {
        return <<<PROMPT
You are an expert forensic procurement analyst for a construction company. Your job is to find HIDDEN insights that are NOT obvious from looking at the raw numbers.

CRITICAL RULES:
1. DO NOT simply restate metrics or percentages that are already in the data
2. DO NOT say things like "you have X POs with variance" - the user can see that
3. FOCUS on patterns, anomalies, correlations, and root causes
4. ASK probing questions that need investigation
5. IDENTIFY supplier behavior patterns and potential issues
6. COMPARE suppliers against each other - who is an outlier?
7. LOOK for systemic issues in the procurement process

Your insights should answer questions like:
- Why is Supplier A's variance so much higher than others?
- Is there a pattern in which types of items get modified?
- Are certain projects more prone to cost overruns?
- What does the ratio of price increases vs decreases tell us about supplier negotiation?
- Are items being added post-order as a pattern (scope creep indicator)?
- If price list violations exist, what's the common thread?

Format your response as JSON:
{
    "headline": "One powerful sentence summarizing the most critical non-obvious finding",
    "hidden_patterns": [
        {"pattern": "Description of a pattern found", "significance": "Why this matters", "investigate": "What to look into"}
    ],
    "anomalies": [
        {"what": "The anomaly detected", "expected": "What would be normal", "actual": "What was found", "risk_level": "high|medium|low"}
    ],
    "supplier_behavior": [
        {"supplier": "Name", "behavior": "Behavioral pattern observed", "concern_level": "high|medium|low", "action": "What to do about it"}
    ],
    "process_gaps": [
        {"gap": "Process weakness identified", "evidence": "How this shows in the data", "fix": "How to address it"}
    ],
    "questions_to_investigate": [
        "Question 1 that needs answers",
        "Question 2 that needs answers"
    ],
    "if_this_continues": "Prediction of what happens if current trends continue unchecked",
    "quick_wins": [
        {"action": "Immediate action to take", "expected_impact": "What improvement to expect"}
    ]
}
PROMPT;
    }

    /**
     * Build the analysis prompt from the summary data
     */
    private function buildPrompt(array $data): string
    {
        $overview = $data['overview'] ?? [];
        $financial = $data['financial_summary'] ?? [];
        $changes = $data['line_item_changes'] ?? [];
        $trends = $data['price_trends'] ?? [];
        $priceListCompliance = $data['price_list_compliance'] ?? [];
        $supplierVars = $data['top_suppliers_by_variance'] ?? [];
        $locationVars = $data['top_locations_by_variance'] ?? [];
        $significantPOs = $data['significant_po_discrepancies'] ?? [];

        $prompt = "ANALYZE this procurement data for HIDDEN patterns and anomalies. DO NOT restate the obvious metrics.\n\n";
        $prompt .= "Find correlations, outliers, process issues, and supplier behavior patterns.\n\n";

        // Raw data for analysis
        $prompt .= "=== RAW DATA ===\n\n";

        $prompt .= "POs: " . ($overview['total_purchase_orders'] ?? 0);
        $prompt .= " | With issues: " . ($overview['pos_with_discrepancies'] ?? 0);
        $prompt .= " (" . ($overview['discrepancy_rate'] ?? 0) . "%)\n";

        $prompt .= "Values: Original $" . number_format($financial['total_original_value'] ?? 0, 0);
        $prompt .= " → Current $" . number_format($financial['total_premier_value'] ?? 0, 0);
        $prompt .= " → Invoiced $" . number_format($financial['total_invoiced_value'] ?? 0, 0);
        $prompt .= " | Variance: $" . number_format($financial['net_variance'] ?? 0, 0);
        $prompt .= " (" . ($financial['variance_percentage'] ?? 0) . "%)\n\n";

        $prompt .= "Line items: ";
        $prompt .= ($changes['items_unchanged'] ?? 0) . " unchanged, ";
        $prompt .= ($changes['items_modified'] ?? 0) . " modified, ";
        $prompt .= ($changes['items_added_in_premier'] ?? 0) . " added post-order, ";
        $prompt .= ($changes['items_removed_from_premier'] ?? 0) . " removed\n";

        $prompt .= "Price changes: ";
        $prompt .= ($trends['unit_cost_increases'] ?? 0) . " increases vs ";
        $prompt .= ($trends['unit_cost_decreases'] ?? 0) . " decreases\n";

        $prompt .= "Qty changes: ";
        $prompt .= ($trends['quantity_increases'] ?? 0) . " increases vs ";
        $prompt .= ($trends['quantity_decreases'] ?? 0) . " decreases\n\n";

        // Price list violations
        if (!empty($priceListCompliance) && ($priceListCompliance['violations_count'] ?? 0) > 0) {
            $prompt .= "*** PRICE LIST VIOLATIONS: " . $priceListCompliance['violations_count'];
            $prompt .= " items with contracted prices changed | Impact: $";
            $prompt .= number_format($priceListCompliance['violation_total_value'], 0) . " ***\n\n";
        }

        // Supplier comparison data
        if (!empty($supplierVars)) {
            $prompt .= "SUPPLIER VARIANCE COMPARISON:\n";
            $avgVariance = 0;
            $count = 0;
            foreach ($supplierVars as $name => $sData) {
                $prompt .= "- {$name}: $" . number_format($sData['total_variance'], 0);
                $prompt .= " across " . $sData['po_count'] . " POs";
                $prompt .= " (" . $sData['variance_percent'] . "% variance rate)";
                $prompt .= " | Avg per PO: $" . number_format($sData['total_variance'] / max(1, $sData['po_count']), 0) . "\n";
                $avgVariance += $sData['variance_percent'];
                $count++;
            }
            if ($count > 1) {
                $prompt .= "Average variance rate: " . round($avgVariance / $count, 1) . "%\n";
            }
            $prompt .= "\n";
        }

        // Project comparison data
        if (!empty($locationVars)) {
            $prompt .= "PROJECT VARIANCE COMPARISON:\n";
            foreach ($locationVars as $name => $lData) {
                $prompt .= "- {$name}: $" . number_format($lData['total_variance'], 0);
                $prompt .= " across " . $lData['po_count'] . " POs";
                $prompt .= " (" . $lData['variance_percent'] . "% variance rate)\n";
            }
            $prompt .= "\n";
        }

        // Individual PO details for pattern detection
        if (!empty($significantPOs)) {
            $prompt .= "SIGNIFICANT POs (>$1K variance) - look for patterns:\n";
            foreach ($significantPOs as $po) {
                $prompt .= "- PO" . $po['po_number'] . " | " . ($po['supplier'] ?? '?') . " | " . ($po['location'] ?? '?');
                $prompt .= " | $" . number_format($po['original_value'], 0) . "→$" . number_format($po['current_value'], 0);
                $prompt .= " | +" . $po['items_added'] . "/-" . $po['items_removed'] . "/" . $po['items_modified'] . "mod\n";
            }
            $prompt .= "\n";
        }

        $prompt .= "=== ANALYSIS REQUIRED ===\n";
        $prompt .= "1. Which supplier stands out as an outlier? Why?\n";
        $prompt .= "2. Is there a pattern in items being added post-order (scope creep)?\n";
        $prompt .= "3. What does the price increase vs decrease ratio indicate?\n";
        $prompt .= "4. Are certain projects systematically over-running? Why might that be?\n";
        $prompt .= "5. What process weakness does this data reveal?\n";
        $prompt .= "6. If price list violations exist, what's the likely root cause?\n\n";
        $prompt .= "Provide insights in the JSON format specified. Be specific, not generic.";

        return $prompt;
    }

    /**
     * Parse the AI response into structured insights
     */
    private function parseInsights(string $content): array
    {
        // Try to extract JSON from the response
        $jsonMatch = preg_match('/\{[\s\S]*\}/', $content, $matches);

        if ($jsonMatch) {
            $parsed = json_decode($matches[0], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $parsed;
            }
        }

        // If JSON parsing fails, return the raw content with default structure
        return [
            'headline' => $content,
            'hidden_patterns' => [],
            'anomalies' => [],
            'supplier_behavior' => [],
            'process_gaps' => [],
            'questions_to_investigate' => [],
            'if_this_continues' => '',
            'quick_wins' => [],
            'parsing_note' => 'Response could not be parsed as JSON, displaying raw content.',
        ];
    }

    /**
     * Clear cached insights
     */
    public function clearCache(array $summaryData): void
    {
        $cacheKey = 'po_insights_' . md5(json_encode($summaryData));
        Cache::forget($cacheKey);
    }
}
