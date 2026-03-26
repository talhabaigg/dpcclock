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
        $templateName = $this->signingRequest->documentTemplate?->name ?? 'Document';

        return (new MailMessage)
            ->subject("Please review and sign: {$templateName}")
            ->greeting("Hi {$this->signingRequest->recipient_name},")
            ->line("You have a document that requires your signature: **{$templateName}**.")
            ->line('Please click the button below to review the document and provide your electronic signature.')
            ->action('Review & Sign Document', $this->signingRequest->getSigningUrl())
            ->line('This link will expire in 7 days.')
            ->line('If you did not expect this document, please disregard this email.');
    }
}
