<?php

namespace App\Notifications;

use App\Notifications\Channels\ClickSendChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class BatchSigningSmsNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private string $senderName,
        private int $documentCount,
        private string $shortUrl,
    ) {}

    public function via(object $notifiable): array
    {
        return [ClickSendChannel::class];
    }

    public function toClicksend(object $notifiable): string
    {
        $prefix = app()->environment('production') ? '' : 'TEST - ';
        $noun = $this->documentCount === 1 ? 'a document' : "{$this->documentCount} documents";

        return "{$prefix}{$this->senderName} has sent you {$noun} to sign: {$this->shortUrl} (expires in 7 days)";
    }
}
