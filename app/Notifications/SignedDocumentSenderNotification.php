<?php

namespace App\Notifications;

use App\Models\SigningRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class SignedDocumentSenderNotification extends Notification implements ShouldQueue
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

        $signerName = $this->signingRequest->signer_full_name ?? $this->signingRequest->recipient_name ?? 'Recipient';

        $message = (new MailMessage)
            ->subject("Signed: {$documentLabel} — {$signerName}")
            ->greeting("Hi,")
            ->line("**{$signerName}** has signed **{$documentLabel}**. A copy of the fully-signed document is attached for your records.")
            ->line('Signed on ' . $this->signingRequest->signed_at?->timezone('Australia/Brisbane')->format('d/m/Y h:i A T'));

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
