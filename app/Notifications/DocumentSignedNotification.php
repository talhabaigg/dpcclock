<?php

namespace App\Notifications;

use App\Models\SigningRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class DocumentSignedNotification extends Notification
{
    use Queueable;

    public function __construct(
        private SigningRequest $signingRequest,
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['database'];

        if ($notifiable->pushSubscriptions()->exists()) {
            $channels[] = WebPushChannel::class;
        }

        return $channels;
    }

    public function toWebPush(object $notifiable, $notification): WebPushMessage
    {
        $data = $this->toArray($notifiable);

        return (new WebPushMessage)
            ->title($data['title'])
            ->body($data['body'])
            ->icon('/icon-192x192.png')
            ->badge('/icon-192x192.png')
            ->tag('document-signed-' . $this->signingRequest->id)
            ->options(['TTL' => 86400]);
    }

    public function toArray(object $notifiable): array
    {
        $templateName = $this->signingRequest->documentTemplate?->name ?? 'Document';

        return [
            'type' => 'DocumentSigned',
            'title' => 'Document Signed',
            'body' => "{$this->signingRequest->signer_full_name} has signed \"{$templateName}\".",
            'signing_request_id' => $this->signingRequest->id,
            'signer_name' => $this->signingRequest->signer_full_name,
            'template_name' => $templateName,
        ];
    }
}
