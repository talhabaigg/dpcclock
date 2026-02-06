<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

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
    public function generateInsights(array $summaryData, ?string $conversationId = null): array
    {
        if (! $this->apiKey) {
            return [
                'success' => false,
                'error' => 'OpenAI API key not configured',
                'response' => null,
            ];
        }

        // Generate conversation ID if not provided
        $conversationId = $conversationId ?: 'po_insights_'.md5(json_encode($summaryData).time());

        // Check cache for existing conversation
        $cacheKey = 'po_conversation_'.$conversationId;
        $cached = Cache::get($cacheKey);

        if ($cached && ! empty($cached['response'])) {
            return [
                'success' => true,
                'response' => $cached['response'],
                'conversation_id' => $conversationId,
                'cached' => true,
            ];
        }

        $prompt = $this->buildPrompt($summaryData);

        try {
            $messages = [
                [
                    'role' => 'system',
                    'content' => $this->getSystemPrompt(),
                ],
                [
                    'role' => 'user',
                    'content' => $prompt,
                ],
            ];

            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(90)->post('https://api.openai.com/v1/chat/completions', [
                'model' => $this->model,
                'messages' => $messages,
                'temperature' => 0.7,
                'max_tokens' => 3000,
            ]);

            if ($response->failed()) {
                Log::error('OpenAI API request failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return [
                    'success' => false,
                    'error' => 'Failed to generate insights: '.$response->body(),
                    'response' => null,
                ];
            }

            $content = $response->json('choices.0.message.content');

            // Store conversation context for follow-ups
            Cache::put($cacheKey, [
                'response' => $content,
                'messages' => [
                    ...$messages,
                    ['role' => 'assistant', 'content' => $content],
                ],
                'summary_data' => $summaryData,
            ], now()->addHours(2));

            return [
                'success' => true,
                'response' => $content,
                'conversation_id' => $conversationId,
                'cached' => false,
            ];

        } catch (\Exception $e) {
            Log::error('OpenAI API exception', [
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'Failed to generate insights: '.$e->getMessage(),
                'response' => null,
            ];
        }
    }

    /**
     * Handle follow-up questions in the conversation
     */
    public function askFollowUp(string $conversationId, string $question): array
    {
        if (! $this->apiKey) {
            return [
                'success' => false,
                'error' => 'OpenAI API key not configured',
                'response' => null,
            ];
        }

        $cacheKey = 'po_conversation_'.$conversationId;
        $conversation = Cache::get($cacheKey);

        if (! $conversation) {
            return [
                'success' => false,
                'error' => 'Conversation not found or expired. Please generate new insights first.',
                'response' => null,
            ];
        }

        try {
            // Add the follow-up question to the conversation
            $messages = $conversation['messages'];
            $messages[] = ['role' => 'user', 'content' => $question];

            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(90)->post('https://api.openai.com/v1/chat/completions', [
                'model' => $this->model,
                'messages' => $messages,
                'temperature' => 0.7,
                'max_tokens' => 2000,
            ]);

            if ($response->failed()) {
                Log::error('OpenAI API follow-up request failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return [
                    'success' => false,
                    'error' => 'Failed to process follow-up: '.$response->body(),
                    'response' => null,
                ];
            }

            $content = $response->json('choices.0.message.content');

            // Update conversation history
            $messages[] = ['role' => 'assistant', 'content' => $content];
            $conversation['messages'] = $messages;
            $conversation['response'] = $content;
            Cache::put($cacheKey, $conversation, now()->addHours(2));

            return [
                'success' => true,
                'response' => $content,
                'conversation_id' => $conversationId,
            ];

        } catch (\Exception $e) {
            Log::error('OpenAI API follow-up exception', [
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'Failed to process follow-up: '.$e->getMessage(),
                'response' => null,
            ];
        }
    }

    /**
     * Get the system prompt for the AI
     */
    private function getSystemPrompt(): string
    {
        return <<<'PROMPT'
You are an elite procurement analyst and trusted advisor for a construction company. You communicate like a senior consultant having a direct conversation with the CFO or Operations Director.

YOUR COMMUNICATION STYLE:
- Speak conversationally, like you're in a meeting explaining findings
- Be direct and confident - lead with your most important insight
- Use "you" and "your" - make it personal to their business
- Ask rhetorical or probing questions to guide their thinking
- Use bold for key numbers and important findings
- Structure with clear headings but keep it flowing
- End with specific questions THEY should be asking or investigating

WHAT TO FOCUS ON:
- Hidden patterns that aren't obvious from the numbers
- Supplier behavior that seems unusual or concerning
- Comparisons between suppliers/projects that reveal outliers
- Process weaknesses the data reveals
- Root causes, not just symptoms
- Actionable next steps

WHAT TO AVOID:
- Don't just restate the numbers they can already see
- Don't be generic - be specific to THEIR data
- Don't hedge excessively - be confident in your analysis
- Don't use corporate jargon or buzzwords

FORMAT YOUR RESPONSE AS:
Use markdown formatting with:
- **Bold** for key numbers and critical findings
- Clear section headers (## style)
- Bullet points for lists
- > Blockquotes for important callouts or warnings

Always end your response with a "Questions to Investigate" or "Next Steps" section that gives them specific actions.

Remember: You're a trusted advisor who's been analyzing their procurement data. Speak with authority and give them insights they couldn't easily see themselves.
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
        $varianceDistribution = $data['variance_distribution'] ?? [];
        $monthlyTrends = $data['monthly_trends'] ?? [];
        $supplierVars = $data['top_suppliers_by_variance'] ?? [];
        $locationVars = $data['top_locations_by_variance'] ?? [];
        $significantPOs = $data['significant_po_discrepancies'] ?? [];

        $prompt = "I need you to analyze our procurement data and give me your honest assessment. Here's what we're seeing:\n\n";

        // Overview
        $prompt .= "## The Big Picture\n";
        $prompt .= 'We have **'.($overview['total_purchase_orders'] ?? 0)." purchase orders** in this dataset.\n";
        $prompt .= '- '.($overview['pos_with_discrepancies'] ?? 0).' have discrepancies ('.($overview['discrepancy_rate'] ?? 0)."% rate)\n";
        $prompt .= '- Original value: $'.number_format($financial['total_original_value'] ?? 0, 0)."\n";
        $prompt .= '- Current value in Premier: $'.number_format($financial['total_premier_value'] ?? 0, 0)."\n";
        $prompt .= '- Already invoiced: $'.number_format($financial['total_invoiced_value'] ?? 0, 0)."\n";
        $prompt .= '- **Net variance: $'.number_format($financial['net_variance'] ?? 0, 0).'** ('.($financial['variance_percentage'] ?? 0)."%)\n\n";

        // Variance distribution
        if (! empty($varianceDistribution)) {
            $prompt .= "## Variance Distribution\n";
            $prompt .= '- No variance: '.($varianceDistribution['no_variance'] ?? 0)." POs\n";
            $prompt .= '- Minor (<$100): '.($varianceDistribution['minor_under_100'] ?? 0)." POs\n";
            $prompt .= '- Small ($100-500): '.($varianceDistribution['small_100_to_500'] ?? 0)." POs\n";
            $prompt .= '- Medium ($500-1K): '.($varianceDistribution['medium_500_to_1000'] ?? 0)." POs\n";
            $prompt .= '- Large ($1K-5K): '.($varianceDistribution['large_1000_to_5000'] ?? 0)." POs\n";
            $prompt .= '- Major (>$5K): '.($varianceDistribution['major_over_5000'] ?? 0)." POs\n\n";
        }

        // Line item changes
        $prompt .= "## What Changed\n";
        $prompt .= 'Line items: '.($changes['items_unchanged'] ?? 0).' unchanged, ';
        $prompt .= ($changes['items_modified'] ?? 0).' modified, ';
        $prompt .= ($changes['items_added_in_premier'] ?? 0).' added after order, ';
        $prompt .= ($changes['items_removed_from_premier'] ?? 0)." removed\n\n";

        $prompt .= 'Price changes: '.($trends['unit_cost_increases'] ?? 0).' increases vs '.($trends['unit_cost_decreases'] ?? 0)." decreases\n";
        $prompt .= 'Quantity changes: '.($trends['quantity_increases'] ?? 0).' increases vs '.($trends['quantity_decreases'] ?? 0)." decreases\n\n";

        // Price list violations
        if (! empty($priceListCompliance) && ($priceListCompliance['violations_count'] ?? 0) > 0) {
            $prompt .= "## ⚠️ Price List Violations\n";
            $prompt .= '**'.$priceListCompliance['violations_count']." items** with contracted prices have been changed.\n";
            $prompt .= 'Financial impact: **$'.number_format($priceListCompliance['violation_total_value'], 0)."**\n\n";
        }

        // Monthly trends
        if (! empty($monthlyTrends)) {
            $prompt .= "## Monthly Trends\n";
            foreach ($monthlyTrends as $month => $mData) {
                $prompt .= "- {$month}: ".$mData['po_count'].' POs, ';
                $prompt .= '$'.number_format($mData['total_variance'], 0).' variance ';
                $prompt .= '('.$mData['variance_percent'].'%), ';
                $prompt .= $mData['discrepancy_rate']."% had issues\n";
            }
            $prompt .= "\n";
        }

        // Supplier comparison
        if (! empty($supplierVars)) {
            $prompt .= "## Supplier Comparison\n";
            foreach ($supplierVars as $name => $sData) {
                $avgPerPo = $sData['po_count'] > 0 ? $sData['total_variance'] / $sData['po_count'] : 0;
                $prompt .= "- **{$name}**: $".number_format($sData['total_variance'], 0);
                $prompt .= ' across '.$sData['po_count'].' POs';
                $prompt .= ' ('.$sData['variance_percent'].'% rate)';
                $prompt .= ' | Avg: $'.number_format($avgPerPo, 0)."/PO\n";
            }
            $prompt .= "\n";
        }

        // Project comparison
        if (! empty($locationVars)) {
            $prompt .= "## Project Comparison\n";
            foreach ($locationVars as $name => $lData) {
                $prompt .= "- **{$name}**: $".number_format($lData['total_variance'], 0);
                $prompt .= ' across '.$lData['po_count'].' POs';
                $prompt .= ' ('.$lData['variance_percent']."% rate)\n";
            }
            $prompt .= "\n";
        }

        // Significant POs
        if (! empty($significantPOs)) {
            $prompt .= "## Notable POs (for pattern detection)\n";
            foreach (array_slice($significantPOs, 0, 15) as $po) {
                $prompt .= '- **PO'.$po['po_number'].'** | '.($po['supplier'] ?? '?');
                $prompt .= ' | '.($po['location'] ?? '?');
                $prompt .= ' | $'.number_format($po['original_value'], 0).' → $'.number_format($po['current_value'], 0);
                $prompt .= ' (**'.($po['variance'] >= 0 ? '+' : '').'$'.number_format($po['variance'], 0).'**)';
                $prompt .= ' | +'.$po['items_added'].' added, -'.$po['items_removed'].' removed, '.$po['items_modified'].' modified';
                if (! empty($po['created_at'])) {
                    $prompt .= ' | '.date('M Y', strtotime($po['created_at']));
                }
                $prompt .= "\n";
            }
            $prompt .= "\n";
        }

        $prompt .= "---\n\n";
        $prompt .= "Based on this data, give me your analysis. What are the hidden patterns? Which suppliers should I be concerned about? What process issues does this reveal? What should I investigate further?\n\n";
        $prompt .= 'Speak to me like a trusted advisor - be direct, specific, and actionable.';

        return $prompt;
    }

    /**
     * Stream AI insights for PO comparison report data (SSE)
     * Returns a closure to be used with response()->stream()
     */
    public function streamInsights(array $summaryData, ?string $conversationId = null): \Closure
    {
        $apiKey = $this->apiKey;
        $model = $this->model;

        if (! $apiKey) {
            return function () {
                $this->sendSSEData(['error' => 'OpenAI API key not configured']);
            };
        }

        $conversationId = $conversationId ?: 'po_insights_'.md5(json_encode($summaryData).time());
        $prompt = $this->buildPrompt($summaryData);
        $systemPrompt = $this->getSystemPrompt();

        return function () use ($apiKey, $model, $prompt, $systemPrompt, $conversationId, $summaryData) {
            $this->configureStreamOutput();

            $messages = [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $prompt],
            ];

            $fullText = '';

            try {
                $response = Http::withHeaders([
                    'Authorization' => 'Bearer '.$apiKey,
                    'Content-Type' => 'application/json',
                    'Accept' => 'text/event-stream',
                ])->withOptions(['stream' => true])
                    ->timeout(120)
                    ->post('https://api.openai.com/v1/chat/completions', [
                        'model' => $model,
                        'messages' => $messages,
                        'temperature' => 0.7,
                        'max_tokens' => 3000,
                        'stream' => true,
                    ]);

                if ($response->failed()) {
                    $this->sendSSEData(['error' => 'OpenAI API request failed: '.$response->status()]);

                    return;
                }

                $stream = $response->toPsrResponse()->getBody();
                $buffer = '';

                while (! $stream->eof()) {
                    $chunk = $stream->read(1024);
                    if ($chunk === '' || $chunk === false) {
                        usleep(20000);

                        continue;
                    }

                    $buffer .= $chunk;

                    while (($pos = strpos($buffer, "\n")) !== false) {
                        $line = trim(substr($buffer, 0, $pos));
                        $buffer = substr($buffer, $pos + 1);

                        if ($line === '' || strpos($line, 'data: ') !== 0) {
                            continue;
                        }

                        $payload = substr($line, 6);

                        if ($payload === '[DONE]') {
                            break 2;
                        }

                        $event = json_decode($payload, true);
                        if (! is_array($event)) {
                            continue;
                        }

                        $delta = $event['choices'][0]['delta']['content'] ?? null;
                        if ($delta !== null && $delta !== '') {
                            $fullText .= $delta;
                            $this->sendSSEData(['delta' => $delta]);
                        }
                    }
                }

                // Store conversation context for follow-ups
                if ($fullText !== '') {
                    $cacheKey = 'po_conversation_'.$conversationId;
                    Cache::put($cacheKey, [
                        'response' => $fullText,
                        'messages' => [
                            ...$messages,
                            ['role' => 'assistant', 'content' => $fullText],
                        ],
                        'summary_data' => $summaryData,
                    ], now()->addHours(2));
                }

                $this->sendSSEEvent('done', ['conversation_id' => $conversationId]);

            } catch (\Exception $e) {
                Log::error('POInsightsService streaming error', ['error' => $e->getMessage()]);
                $this->sendSSEData(['error' => 'Streaming failed: '.$e->getMessage()]);
            }
        };
    }

    /**
     * Stream follow-up question response (SSE)
     * Returns a closure to be used with response()->stream()
     */
    public function streamFollowUp(string $conversationId, string $question): \Closure
    {
        $apiKey = $this->apiKey;
        $model = $this->model;

        if (! $apiKey) {
            return function () {
                $this->sendSSEData(['error' => 'OpenAI API key not configured']);
            };
        }

        $cacheKey = 'po_conversation_'.$conversationId;
        $conversation = Cache::get($cacheKey);

        if (! $conversation) {
            return function () {
                $this->sendSSEData(['error' => 'Conversation not found or expired. Please start a new analysis.']);
            };
        }

        return function () use ($apiKey, $model, $conversationId, $question, $conversation, $cacheKey) {
            $this->configureStreamOutput();

            $messages = $conversation['messages'];
            $messages[] = ['role' => 'user', 'content' => $question];

            $fullText = '';

            try {
                $response = Http::withHeaders([
                    'Authorization' => 'Bearer '.$apiKey,
                    'Content-Type' => 'application/json',
                    'Accept' => 'text/event-stream',
                ])->withOptions(['stream' => true])
                    ->timeout(120)
                    ->post('https://api.openai.com/v1/chat/completions', [
                        'model' => $model,
                        'messages' => $messages,
                        'temperature' => 0.7,
                        'max_tokens' => 2000,
                        'stream' => true,
                    ]);

                if ($response->failed()) {
                    $this->sendSSEData(['error' => 'OpenAI API request failed: '.$response->status()]);

                    return;
                }

                $stream = $response->toPsrResponse()->getBody();
                $buffer = '';

                while (! $stream->eof()) {
                    $chunk = $stream->read(1024);
                    if ($chunk === '' || $chunk === false) {
                        usleep(20000);

                        continue;
                    }

                    $buffer .= $chunk;

                    while (($pos = strpos($buffer, "\n")) !== false) {
                        $line = trim(substr($buffer, 0, $pos));
                        $buffer = substr($buffer, $pos + 1);

                        if ($line === '' || strpos($line, 'data: ') !== 0) {
                            continue;
                        }

                        $payload = substr($line, 6);

                        if ($payload === '[DONE]') {
                            break 2;
                        }

                        $event = json_decode($payload, true);
                        if (! is_array($event)) {
                            continue;
                        }

                        $delta = $event['choices'][0]['delta']['content'] ?? null;
                        if ($delta !== null && $delta !== '') {
                            $fullText .= $delta;
                            $this->sendSSEData(['delta' => $delta]);
                        }
                    }
                }

                // Update conversation history
                if ($fullText !== '') {
                    $messages[] = ['role' => 'assistant', 'content' => $fullText];
                    $conversation['messages'] = $messages;
                    $conversation['response'] = $fullText;
                    Cache::put($cacheKey, $conversation, now()->addHours(2));
                }

                $this->sendSSEEvent('done', ['conversation_id' => $conversationId]);

            } catch (\Exception $e) {
                Log::error('POInsightsService follow-up streaming error', ['error' => $e->getMessage()]);
                $this->sendSSEData(['error' => 'Streaming failed: '.$e->getMessage()]);
            }
        };
    }

    /**
     * Configure output settings for streaming
     */
    private function configureStreamOutput(): void
    {
        @ini_set('output_buffering', 'off');
        @ini_set('zlib.output_compression', 0);
        @ini_set('implicit_flush', 1);

        if (ob_get_level()) {
            ob_end_clean();
        }
    }

    /**
     * Send SSE data event
     */
    private function sendSSEData(array $data): void
    {
        echo 'data: '.json_encode($data)."\n\n";
        $this->flushOutput();
    }

    /**
     * Send SSE event with custom event name
     */
    private function sendSSEEvent(string $event, array $data): void
    {
        echo "event: {$event}\n";
        echo 'data: '.json_encode($data)."\n\n";
        $this->flushOutput();
    }

    /**
     * Flush output buffers
     */
    private function flushOutput(): void
    {
        if (ob_get_level() > 0) {
            @ob_flush();
        }
        @flush();
    }

    /**
     * Clear cached insights and conversation
     */
    public function clearCache(array $summaryData): void
    {
        // Clear any conversation caches that match this data pattern
        $pattern = 'po_insights_'.md5(json_encode($summaryData));
        Cache::forget('po_conversation_'.$pattern);
    }
}
