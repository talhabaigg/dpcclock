<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class JobFailureAiSummarizer
{
    public function summarize(string $jobName, string $exceptionClass, string $message, ?string $stackTraceSnippet = null): ?string
    {
        if (! config('queue-failure-alerts.ai_summary.enabled')) {
            return null;
        }

        $apiKey = config('services.openai.api_key') ?: env('OPENAI_API_KEY');
        if (! $apiKey) {
            return null;
        }

        $model = config('queue-failure-alerts.ai_summary.model', 'gpt-4.1-mini');
        $timeout = (int) config('queue-failure-alerts.ai_summary.timeout', 15);

        $userPrompt = <<<PROMPT
A Laravel queued job failed. Suggest the most likely root cause and a recommended next step.

Job: {$jobName}
Exception: {$exceptionClass}
Message: {$message}
PROMPT;

        if ($stackTraceSnippet) {
            $userPrompt .= "\n\nStack trace (truncated):\n{$stackTraceSnippet}";
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$apiKey,
                'Content-Type' => 'application/json',
            ])->timeout($timeout)->post('https://api.openai.com/v1/chat/completions', [
                'model' => $model,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'You are a senior Laravel engineer triaging a failed queued job. Reply in 2-4 short bullet points. Be concrete: identify the most likely cause from the exception and message, then one recommended next step. No preamble, no closing. Plain text only (no markdown headings).',
                    ],
                    [
                        'role' => 'user',
                        'content' => $userPrompt,
                    ],
                ],
                'temperature' => 0.2,
                'max_tokens' => 300,
            ]);

            if ($response->failed()) {
                Log::warning('JobFailureAiSummarizer: OpenAI request failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return null;
            }

            $content = trim((string) $response->json('choices.0.message.content'));
            return $content !== '' ? $content : null;
        } catch (\Throwable $e) {
            Log::warning('JobFailureAiSummarizer: exception while summarizing', [
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
