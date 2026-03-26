<?php

namespace App\Services;

use App\Events\DocumentSigned;
use App\Models\DocumentTemplate;
use App\Models\SigningRequest;
use App\Models\User;
use App\Notifications\DocumentSignedNotification;
use App\Notifications\DocumentSigningNotification;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

class DocumentSigningService
{
    public function __construct(
        private SignedDocumentPdfService $pdfService,
    ) {}

    public function createAndSend(
        DocumentTemplate $template,
        string $deliveryMethod,
        User $admin,
        string $recipientName,
        ?string $recipientEmail,
        array $customFields = [],
        ?Model $signable = null,
        ?string $senderSignature = null,
        ?string $senderFullName = null,
    ): SigningRequest {
        // Cancel any existing pending requests for the same signable
        if ($signable) {
            SigningRequest::query()
                ->where('signable_type', get_class($signable))
                ->where('signable_id', $signable->getKey())
                ->whereIn('status', ['pending', 'sent', 'opened', 'viewed'])
                ->each(function (SigningRequest $existing) use ($admin) {
                    $this->cancel($existing, $admin);
                });
        }

        // Render template HTML with placeholder values
        $placeholderValues = array_merge($customFields, [
            'recipient_name' => $recipientName,
            'recipient_email' => $recipientEmail ?? '',
        ]);
        $documentHtml = $template->renderHtml($placeholderValues);

        // Replace sender signature placeholder with rendered HTML if provided
        if ($senderSignature && str_contains($documentHtml, '{{sender_signature}}')) {
            $senderSignatureHtml = '<div style="margin: 20px 0; padding: 10px; border: 1px solid #ccc;">'
                . '<img src="' . $senderSignature . '" style="max-width: 300px; max-height: 100px;" />'
                . '<div style="margin-top: 8px; font-size: 12px; color: #555;">'
                . '<strong>' . e($senderFullName ?? $admin->name) . '</strong><br>'
                . 'Signed: ' . now()->timezone('Australia/Sydney')->format('d/m/Y h:i A T')
                . '</div></div>';
            $documentHtml = str_replace('{{sender_signature}}', $senderSignatureHtml, $documentHtml);
        }

        $documentHash = hash('sha256', $documentHtml);

        $signingRequest = SigningRequest::create([
            'document_template_id' => $template->id,
            'signable_type' => $signable ? get_class($signable) : null,
            'signable_id' => $signable?->getKey(),
            'delivery_method' => $deliveryMethod,
            'token' => Str::random(64),
            'status' => 'pending',
            'sent_by' => $admin->id,
            'document_html' => $documentHtml,
            'document_hash' => $documentHash,
            'recipient_name' => $recipientName,
            'recipient_email' => $recipientEmail,
            'custom_fields' => $customFields,
            'sender_signature' => $senderSignature,
            'sender_full_name' => $senderFullName,
            'expires_at' => now()->addDays(7),
        ]);

        $signingRequest->logEvent('created', 'admin', $admin->id);

        if ($senderSignature) {
            $signingRequest->logEvent('sender_signed', 'admin', $admin->id, null, [
                'sender_name' => $senderFullName ?? $admin->name,
            ]);
        }

        // Deliver based on method
        if ($deliveryMethod === 'email' && $recipientEmail) {
            Notification::route('mail', $recipientEmail)
                ->notify(new DocumentSigningNotification($signingRequest));
            $signingRequest->update(['status' => 'sent']);
            $signingRequest->logEvent('sent', 'system', null, null, ['method' => 'email', 'to' => $recipientEmail]);
        } else {
            // in_person — no external delivery, admin opens URL on device
            $signingRequest->update(['status' => 'sent']);
            $signingRequest->logEvent('sent', 'admin', $admin->id, null, ['method' => 'in_person']);
        }

        // Update signable status if applicable (e.g., EmploymentApplication -> contract_sent)
        if ($signable && method_exists($signable, 'update') && property_exists($signable, 'status')) {
            if ($signable instanceof \App\Models\EmploymentApplication) {
                $signable->update(['status' => \App\Models\EmploymentApplication::STATUS_CONTRACT_SENT]);
            }
        }

        // Add system comment on signable if it supports comments
        if ($signable && method_exists($signable, 'addSystemComment')) {
            $methodLabel = $deliveryMethod === 'email' ? 'email' : 'in-person';
            $signable->addSystemComment(
                "Document sent for signing via {$methodLabel} by {$admin->name}",
                ['type' => 'document_sent', 'signing_request_id' => $signingRequest->id],
                $admin->id,
            );
        }

        return $signingRequest;
    }

    public function markOpened(SigningRequest $signingRequest, Request $request): void
    {
        if (! $signingRequest->opened_at) {
            $signingRequest->update(['opened_at' => now()]);
            $signingRequest->logEvent('opened', 'signer', null, $request);

            if ($signingRequest->status === 'sent') {
                $signingRequest->update(['status' => 'opened']);
            }
        }
    }

    public function markViewed(SigningRequest $signingRequest, Request $request): void
    {
        if (! $signingRequest->viewed_at) {
            $signingRequest->update(['viewed_at' => now()]);
            $signingRequest->logEvent('viewed', 'signer', null, $request);

            if (in_array($signingRequest->status, ['sent', 'opened'])) {
                $signingRequest->update(['status' => 'viewed']);
            }
        }
    }

    public function processSignature(
        SigningRequest $signingRequest,
        string $signatureDataUrl,
        string $signerFullName,
        Request $request,
    ): void {
        if ($signingRequest->isSigned()) {
            throw new \RuntimeException('This document has already been signed.');
        }

        if ($signingRequest->isExpired()) {
            throw new \RuntimeException('This signing link has expired.');
        }

        if ($signingRequest->isCancelled()) {
            throw new \RuntimeException('This signing request has been cancelled.');
        }

        // Update signing details
        $signingRequest->update([
            'signer_full_name' => $signerFullName,
            'signer_ip_address' => $request->ip(),
            'signer_user_agent' => $request->userAgent(),
            'signed_at' => now(),
            'status' => 'signed',
        ]);

        $signingRequest->logEvent('signed', 'signer', null, $request, [
            'signer_name' => $signerFullName,
        ]);

        // Store signature image
        $signingRequest->addMediaFromBase64($signatureDataUrl)
            ->usingFileName('signature.png')
            ->toMediaCollection('signature');

        // Generate signed PDF
        $pdfContent = $this->pdfService->generate($signingRequest, $signatureDataUrl);

        $signingRequest->addMediaFromString($pdfContent)
            ->usingFileName('signed-document.pdf')
            ->withCustomProperties(['document_hash' => $signingRequest->document_hash])
            ->toMediaCollection('signed_document');

        $signingRequest->logEvent('pdf_generated', 'system');

        // Fire event for listeners (e.g., update employment application status)
        DocumentSigned::dispatch($signingRequest);

        // Notify admins
        $admin = $signingRequest->sentBy;
        if ($admin) {
            $admin->notify(new DocumentSignedNotification($signingRequest));
        }
    }

    public function cancel(SigningRequest $signingRequest, User $admin): void
    {
        $signingRequest->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
            'cancelled_by' => $admin->id,
        ]);

        $signingRequest->logEvent('cancelled', 'admin', $admin->id);
    }

    public function resend(SigningRequest $signingRequest, User $admin): SigningRequest
    {
        // Cancel the old request
        $this->cancel($signingRequest, $admin);

        // Create a new one with the same parameters
        $template = $signingRequest->documentTemplate;

        return $this->createAndSend(
            $template,
            $signingRequest->delivery_method,
            $admin,
            $signingRequest->recipient_name,
            $signingRequest->recipient_email,
            $signingRequest->custom_fields ?? [],
            $signingRequest->signable,
            $signingRequest->sender_signature,
            $signingRequest->sender_full_name,
        );
    }
}
