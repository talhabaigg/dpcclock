<?php

namespace App\Notifications;

use App\Models\SigningRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class InternalSignatureRequestedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private SigningRequest $signingRequest,
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['mail', 'database'];

        if ($notifiable->pushSubscriptions()->exists()) {
            $channels[] = WebPushChannel::class;
        }

        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $documentLabel = $this->signingRequest->documentTemplate?->name
            ?? $this->signingRequest->document_title
            ?? 'Document';

        $admin = $this->signingRequest->sentBy;

        return (new MailMessage)
            ->subject("Signature requested: {$documentLabel}")
            ->greeting("Hi {$notifiable->name},")
            ->line("{$admin?->name} has requested your signature on **{$documentLabel}** before it is sent to {$this->signingRequest->recipient_name}.")
            ->line('Please click the button below to review the document and provide your signature.')
            ->action('Review & Sign', $this->signingRequest->getInternalSigningUrl())
            ->line('Once you sign, the document will be automatically sent to the recipient.');
    }

    public function toWebPush(object $notifiable, $notification): WebPushMessage
    {
        $data = $this->toArray($notifiable);

        return (new WebPushMessage)
            ->title($data['title'])
            ->body($data['body'])
            ->icon('/icon-192x192.png')
            ->badge('/icon-192x192.png')
            ->tag('internal-sign-' . $this->signingRequest->id)
            ->options(['TTL' => 86400]);
    }

    public function toArray(object $notifiable): array
    {
        $documentLabel = $this->signingRequest->documentTemplate?->name
            ?? $this->signingRequest->document_title
            ?? 'Document';

        return [
            'type' => 'InternalSignatureRequested',
            'title' => 'Signature requested',
            'body' => "Your signature is needed on \"{$documentLabel}\" before it can be sent to {$this->signingRequest->recipient_name}.",
            'signing_request_id' => $this->signingRequest->id,
            'url' => $this->signingRequest->getInternalSigningUrl(),
        ];
    }
}
