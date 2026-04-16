<?php

namespace App\Notifications;

use App\Models\SigningRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class SignedDocumentNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private SigningRequest $signingRequest,
        private ?string $adminBccEmail = null,
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

        $message = (new MailMessage)
            ->subject("Your signed copy: {$documentLabel}")
            ->greeting("Hi {$this->signingRequest->signer_full_name},")
            ->line("Thanks for signing **{$documentLabel}**. A copy of the fully-signed document is attached to this email for your records.")
            ->line('Signed on ' . $this->signingRequest->signed_at?->timezone('Australia/Brisbane')->format('d/m/Y h:i A T'))
            ->line('If you have any questions about this document, please contact the sender.');

        if ($this->adminBccEmail) {
            $message->bcc($this->adminBccEmail);
        }

        $pdf = $this->signingRequest->getFirstMedia('signed_document');
        if ($pdf) {
            $filename = Str::slug($documentLabel) . '-signed.pdf';
            $message->attachData(file_get_contents($pdf->getPath()), $filename, [
                'mime' => 'application/pdf',
            ]);
        }

        return $message;
    }
}
