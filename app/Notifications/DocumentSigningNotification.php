<?php

namespace App\Notifications;

use App\Models\SigningRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class DocumentSigningNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private SigningRequest $signingRequest,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $documentLabel = $this->signingRequest->documentTemplate?->name
            ?? $this->signingRequest->document_title
            ?? 'Document';

        $senderName = $this->signingRequest->sentBy?->name ?? 'Your employer';
        $recipientName = $this->signingRequest->recipient_name;

        return (new MailMessage)
            ->subject("{$senderName} has sent you \"{$documentLabel}\" to sign")
            ->greeting("Hi {$recipientName},")
            ->line("{$senderName} has sent you **{$documentLabel}** for your signature.")
            ->line('Please click the button below to review the document and provide your electronic signature.')
            ->action('Review & Sign', $this->signingRequest->getSigningUrl())
            ->line('This link will expire in 7 days.')
            ->line('If you did not expect this, please contact the sender directly.');
    }
}
