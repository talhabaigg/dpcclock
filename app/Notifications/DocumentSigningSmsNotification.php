<?php

namespace App\Notifications;

use App\Models\SigningRequest;
use App\Notifications\Channels\ClickSendChannel;
use App\Services\ShortLinkService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class DocumentSigningSmsNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private SigningRequest $signingRequest,
    ) {}

    public function via(object $notifiable): array
    {
        return [ClickSendChannel::class];
    }

    public function toClicksend(object $notifiable): string
    {
        $prefix = app()->environment('production') ? '' : 'TEST - ';
        $senderName = $this->signingRequest->sentBy?->name ?? 'Your employer';
        $documentLabel = $this->signingRequest->documentTemplate?->name
            ?? $this->signingRequest->document_title
            ?? 'Document';

        $shortLinks = app(ShortLinkService::class);
        $url = $shortLinks->create($this->signingRequest->getSigningUrl(), 60 * 24 * 7);

        return "{$prefix}{$senderName} has sent you \"{$documentLabel}\" to sign: {$url} (expires in 7 days)";
    }
}
