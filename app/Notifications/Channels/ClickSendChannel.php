<?php

namespace App\Notifications\Channels;

use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ClickSendChannel
{
    public function send(object $notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toClicksend')) {
            return;
        }

        $to = $notifiable->routeNotificationFor('clicksend', $notification);
        if (empty($to)) {
            return;
        }

        $body = trim((string) $notification->toClicksend($notifiable));
        if ($body === '') {
            return;
        }

        $username = config('services.clicksend.username');
        $apiKey = config('services.clicksend.api_key');

        if (empty($username) || empty($apiKey)) {
            Log::warning('ClickSend credentials missing; SMS not sent.', [
                'notifiable' => $notifiable::class,
                'id' => $notifiable->getKey() ?? null,
            ]);

            return;
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
        }
    }
}
