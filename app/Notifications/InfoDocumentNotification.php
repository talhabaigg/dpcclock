<?php

namespace App\Notifications;

use App\Models\SigningRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class InfoDocumentNotification extends Notification implements ShouldQueue
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

        $message = (new MailMessage)
            ->subject("{$senderName} has sent you: {$documentLabel}")
            ->greeting("Hi {$this->signingRequest->recipient_name},")
            ->line("{$senderName} has sent you **{$documentLabel}** for your records.")
            ->line('The document is attached to this email. No action is required — this is for your information only.');

        // Attach uploaded PDF if available
        $uploadedMedia = $this->signingRequest->getFirstMedia('uploaded_document');
        if ($uploadedMedia) {
            $filename = Str::slug($documentLabel) . '.pdf';
            $message->attachData(file_get_contents($uploadedMedia->getPath()), $filename, [
                'mime' => $uploadedMedia->mime_type,
            ]);
        } else {
            // Render the HTML to PDF and attach
            try {
                $pdfService = app(\App\Services\SignedDocumentPdfService::class);
                $pdfContent = $pdfService->generatePreview($this->signingRequest);
                $filename = Str::slug($documentLabel) . '.pdf';
                $message->attachData($pdfContent, $filename, ['mime' => 'application/pdf']);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('Failed to generate PDF for info document', [
                    'signing_request_id' => $this->signingRequest->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $message;
    }
}
