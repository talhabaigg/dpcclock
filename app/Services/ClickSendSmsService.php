<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ClickSendSmsService
{
    /**
     * Send a raw SMS via ClickSend. Returns true on success, false on failure
     * (including missing credentials).
     */
    public function send(string $to, string $body): bool
    {
        $username = config('services.clicksend.username');
        $apiKey = config('services.clicksend.api_key');

        if (empty($username) || empty($apiKey)) {
            Log::warning('ClickSend credentials missing; SMS not sent.', ['to' => $to]);

            return false;
        }

        $message = array_filter([
            'source' => 'laravel',
            'to' => $to,
            'body' => $body,
            'from' => config('services.clicksend.from') ?: null,
        ], fn ($v) => $v !== null && $v !== '');

        $response = Http::withBasicAuth($username, $apiKey)
            ->acceptJson()
            ->asJson()
            ->timeout(15)
            ->post('https://rest.clicksend.com/v3/sms/send', [
                'messages' => [$message],
            ]);

        if ($response->failed()) {
            Log::error('ClickSend SMS failed', [
                'status' => $response->status(),
                'body' => $response->body(),
                'to' => $to,
            ]);

            return false;
        }

        return true;
    }
}
