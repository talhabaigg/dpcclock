<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AiTextController extends Controller
{
    private function getApiKey(): string
    {
        $key = config('services.openai.api_key') ?: env('OPENAI_API_KEY') ?: env('VITE_OPEN_AI_API_KEY');

        if (! $key) {
            throw new \RuntimeException('OpenAI API key is not configured');
        }

        return $key;
    }

    /**
     * Stream an AI text transformation (summarize, proofread, rephrase).
     */
    public function stream(Request $request): StreamedResponse
    {
        $request->validate([
            'action' => 'required|in:summarize,proofread,rephrase,improve,shorten,write',
            'text' => 'required_unless:action,write|nullable|string|max:10000',
            'prompt' => 'nullable|string|max:500',
        ]);

        $action = $request->input('action');
        $text = $request->input('text');
        $prompt = $request->input('prompt');

        $systemPrompt = match ($action) {
            'summarize' => 'You are a concise summarizer. Summarize the following text, keeping the key points. Return only the summary in HTML format using <p>, <ul>, <li>, <strong>, <em> tags as appropriate. Do not wrap in a code block.',
            'proofread' => 'You are a professional proofreader. Fix grammar, spelling, punctuation, and improve clarity of the following text. Return only the corrected text in HTML format using <p>, <ul>, <li>, <strong>, <em> tags as appropriate. Do not wrap in a code block. Do not explain what you changed.',
            'rephrase' => "You are a professional writer. Rephrase the following text according to this instruction: \"{$prompt}\". Return only the rephrased text in HTML format using <p>, <ul>, <li>, <strong>, <em> tags as appropriate. Do not wrap in a code block. Do not explain what you changed.",
            'improve' => 'You are a professional editor. Improve the following text by enhancing clarity, flow, word choice, and overall quality while preserving the original meaning. Return only the improved text in HTML format using <p>, <ul>, <li>, <strong>, <em> tags as appropriate. Do not wrap in a code block. Do not explain what you changed.',
            'shorten' => 'You are a concise editor. Shorten the following text significantly while preserving all key information and meaning. Remove redundancy and unnecessary words. Return only the shortened text in HTML format using <p>, <ul>, <li>, <strong>, <em> tags as appropriate. Do not wrap in a code block. Do not explain what you changed.',
            'write' => 'You are a professional writer. Write content based on the following description/instructions. Return only the written content in HTML format using <p>, <ul>, <li>, <strong>, <em> tags as appropriate. Do not wrap in a code block. Do not include any preamble or explanation.',
        };

        $userContent = $action === 'write' ? ($prompt ?? $text ?? '') : $text;

        return response()->stream(function () use ($systemPrompt, $userContent) {
            try {
                $response = Http::timeout(30)->withHeaders([
                    'Authorization' => 'Bearer '.$this->getApiKey(),
                    'Content-Type' => 'application/json',
                ])->withOptions([
                    'stream' => true,
                ])->post('https://api.openai.com/v1/chat/completions', [
                    'model' => 'gpt-4.1-mini',
                    'stream' => true,
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ['role' => 'user', 'content' => $userContent],
                    ],
                    'temperature' => 0.3,
                ]);

                if ($response->failed()) {
                    $errorBody = (string) $response->getBody();
                    Log::error('AiText OpenAI error', ['status' => $response->status(), 'body' => $errorBody]);
                    echo 'data: '.json_encode(['error' => 'OpenAI returned status '.$response->status()])."\n\n";
                    if (ob_get_level()) { ob_flush(); }
                    flush();

                    return;
                }

                $body = $response->getBody();

                while (! $body->eof()) {
                    $line = '';
                    while (! $body->eof()) {
                        $char = $body->read(1);
                        if ($char === "\n") {
                            break;
                        }
                        $line .= $char;
                    }

                    $line = trim($line);
                    if (! str_starts_with($line, 'data: ')) {
                        continue;
                    }

                    $data = substr($line, 6);
                    if ($data === '[DONE]') {
                        echo "data: [DONE]\n\n";
                        break;
                    }

                    $json = json_decode($data, true);
                    $content = $json['choices'][0]['delta']['content'] ?? null;

                    if ($content !== null) {
                        echo 'data: '.json_encode(['content' => $content])."\n\n";
                    }

                    if (ob_get_level()) {
                        ob_flush();
                    }
                    flush();
                }
            } catch (\Throwable $e) {
                Log::error('AiText stream error', ['message' => $e->getMessage()]);
                echo 'data: '.json_encode(['error' => $e->getMessage()])."\n\n";
                if (ob_get_level()) { ob_flush(); }
                flush();
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
