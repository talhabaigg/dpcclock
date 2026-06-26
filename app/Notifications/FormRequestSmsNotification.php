<?php

namespace App\Notifications;

use App\Models\FormRequest;
use App\Notifications\Channels\ClickSendChannel;
use App\Services\ShortLinkService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class FormRequestSmsNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private FormRequest $formRequest,
    ) {}

    public function via(object $notifiable): array
    {
        return [ClickSendChannel::class];
    }

    public function toClicksend(object $notifiable): string
    {
        $prefix = app()->environment('production') ? '' : 'TEST - ';
        $senderName = $this->formRequest->sentBy?->name ?? 'Your employer';
        $formLabel = $this->formRequest->formTemplate?->name ?? 'Form';

        $shortLinks = app(ShortLinkService::class);
        $url = $shortLinks->create($this->formRequest->getFormUrl(), 60 * 24 * 7);

        return "{$prefix}{$senderName} has sent you \"{$formLabel}\" to complete: {$url} (expires in 7 days)";
    }
}
