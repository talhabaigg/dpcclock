<?php

namespace App\Services;

use App\Models\PremierGlAccount;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GlAccountSuggestionService
{
    private const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

    private const MODEL = 'gpt-4.1-mini';

    public function suggest(array $receiptData): ?int
    {
        $accounts = PremierGlAccount::orderBy('account_number')->get(['id', 'account_number', 'description']);

        if ($accounts->isEmpty()) {
            return null;
        }

        $accountList = $accounts->map(fn ($a) => "{$a->id}: {$a->account_number} - {$a->description}")->implode("\n");

        $receiptInfo = collect([
            'merchant' => $receiptData['merchant_name'] ?? null,
            'category' => $receiptData['category'] ?? null,
            'amount' => $receiptData['total_amount'] ?? null,
            'description' => $receiptData['description'] ?? null,
        ])->filter()->map(fn ($v, $k) => "{$k}: {$v}")->implode(', ');

        $prompt = <<<PROMPT
You are an accounts payable clerk for a construction company. Given this credit card receipt, pick the most appropriate GL account.

Receipt: {$receiptInfo}

Think about what was ACTUALLY purchased based on the merchant and context:
- Supermarket/grocery purchases (food, drinks, supplies for the team on site) = amenities, NOT entertainment
- Entertainment is specifically for client dining, corporate events, staff social functions
- Consider the merchant type AND the likely purpose in a construction business context

Return ONLY the numeric ID (the number before the colon) of the best matching account. Nothing else.

{$accountList}
PROMPT;

        try {
            $response = Http::withToken($this->getApiKey())
                ->timeout(15)
                ->post(self::OPENAI_API_URL, [
                    'model' => self::MODEL,
                    'messages' => [
                        ['role' => 'user', 'content' => $prompt],
                    ],
                    'max_tokens' => 10,
                    'temperature' => 0,
                ]);

            if ($response->failed()) {
                Log::warning('GL account suggestion API failed', ['status' => $response->status()]);

                return null;
            }

            $text = trim($response->json('choices.0.message.content') ?? '');
            $suggestedId = (int) preg_replace('/\D/', '', $text);

            Log::info('GL account suggestion result', [
                'receipt_data' => $receiptInfo,
                'raw_response' => $text,
                'parsed_id' => $suggestedId,
                'valid' => $accounts->contains('id', $suggestedId),
            ]);

            if ($suggestedId && $accounts->contains('id', $suggestedId)) {
                return $suggestedId;
            }

            return null;
        } catch (\Throwable $e) {
            Log::error('GL account suggestion failed', ['error' => $e->getMessage()]);

            return null;
        }
    }

    private function getApiKey(): string
    {
        return config('services.openai.api_key') ?: env('OPENAI_API_KEY');
    }
}
