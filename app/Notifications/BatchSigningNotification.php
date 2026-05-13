<?php

namespace App\Notifications;

use App\Models\SigningRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Sends a single email to a recipient listing every document in a batch.
 *
 * - Signature-required docs render as a list with a per-doc "Sign now" link.
 * - Info-only docs (with uploaded PDFs or rendered HTML) attach the PDF directly.
 */
class BatchSigningNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  Collection<int, SigningRequest>  $signingRequests
     */
    public function __construct(
        private string $recipientName,
        private Collection $signingRequests,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $signing = $this->signingRequests->filter(fn (SigningRequest $sr) => $sr->status !== 'delivered');
        $info = $this->signingRequests->filter(fn (SigningRequest $sr) => $sr->status === 'delivered');
        $first = $this->signingRequests->first();
        $senderName = $first?->sentBy?->name ?? 'Your employer';
        $totalCount = $this->signingRequests->count();

        $signingCount = $signing->count();
        $infoCount = $info->count();

        $subject = $this->buildSubject($senderName, $signingCount, $infoCount, $first);

        $message = (new MailMessage)
            ->subject($subject)
            ->greeting("Hi {$this->recipientName},");

        if ($signingCount > 0) {
            $message->line("{$senderName} has sent you the following document"
                . ($signingCount === 1 ? '' : 's')
                . ' to sign:');

            foreach ($signing as $sr) {
                $label = $this->labelFor($sr);
                $url = $sr->getSigningUrl();
                $message->line("- **{$label}** — [Click here to sign]({$url})");
            }
        }

        if ($infoCount > 0) {
            $message->line($signingCount > 0
                ? 'Also attached for your records:'
                : "{$senderName} has shared the following document"
                    . ($infoCount === 1 ? '' : 's')
                    . ' with you for your records:');

            foreach ($info as $sr) {
                $message->line('- ' . $this->labelFor($sr));
            }
        }

        if ($signingCount > 0) {
            $message->line('Each link will expire in 7 days.');
            $message->line('If you did not expect this, please contact the sender directly.');
        }

        // Attach info-only PDFs.
        foreach ($info as $sr) {
            $this->attachInfoDocument($message, $sr);
        }

        return $message;
    }

    private function buildSubject(string $senderName, int $signingCount, int $infoCount, ?SigningRequest $first): string
    {
        if ($signingCount === 1 && $infoCount === 0 && $first) {
            return "{$senderName} has sent you \"{$this->labelFor($first)}\" to sign";
        }
        if ($signingCount === 0 && $infoCount === 1 && $first) {
            return "{$senderName} has sent you: {$this->labelFor($first)}";
        }
        if ($signingCount > 0 && $infoCount === 0) {
            return "{$senderName} has sent you {$signingCount} documents to sign";
        }
        if ($signingCount === 0 && $infoCount > 0) {
            return "{$senderName} has sent you {$infoCount} documents";
        }
        $total = $signingCount + $infoCount;
        return "{$senderName} has sent you {$total} documents ({$signingCount} to sign)";
    }

    private function labelFor(SigningRequest $sr): string
    {
        return $sr->documentTemplate?->name ?? $sr->document_title ?? 'Document';
    }

    private function attachInfoDocument(MailMessage $message, SigningRequest $sr): void
    {
        $uploaded = $sr->getFirstMedia('uploaded_document');
        $filename = Str::slug($this->labelFor($sr)) . '.pdf';

        if ($uploaded) {
            $contents = Storage::disk($uploaded->disk)->get($uploaded->getPathRelativeToRoot());
            $message->attachData($contents, $filename, ['mime' => $uploaded->mime_type ?? 'application/pdf']);
            return;
        }

        if ($sr->document_html) {
            try {
                $pdfService = app(\App\Services\SignedDocumentPdfService::class);
                $pdf = $pdfService->generateTemplatePreview($sr->document_html);
                $message->attachData($pdf, $filename, ['mime' => 'application/pdf']);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('Failed to generate PDF for batch info attachment', [
                    'signing_request_id' => $sr->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
