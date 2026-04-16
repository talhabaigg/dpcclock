<?php

namespace App\Services;

use App\Contracts\ProvidesSigningPlaceholders;
use App\Events\DocumentSigned;
use App\Models\DocumentTemplate;
use App\Models\SigningRequest;
use App\Models\User;
use App\Notifications\DocumentSignedNotification;
use App\Notifications\DocumentSigningNotification;
use App\Notifications\InternalSignatureRequestedNotification;
use App\Notifications\SignedDocumentNotification;
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
        ?DocumentTemplate $template,
        string $deliveryMethod,
        User $admin,
        string $recipientName,
        ?string $recipientEmail,
        array $customFields = [],
        ?Model $signable = null,
        ?string $senderSignature = null,
        ?string $senderFullName = null,
        ?string $documentHtml = null,
        ?string $documentTitle = null,
        ?string $senderPosition = null,
    ): SigningRequest {
        if ($template === null && ($documentHtml === null || trim($documentHtml) === '')) {
            throw new \InvalidArgumentException('createAndSend requires either a template or raw document HTML.');
        }

        // Cancel any existing pending requests for the same signable + template
        if ($signable && $template) {
            SigningRequest::query()
                ->where('signable_type', get_class($signable))
                ->where('signable_id', $signable->getKey())
                ->where('document_template_id', $template->id)
                ->whereIn('status', ['pending', 'sent', 'opened', 'viewed'])
                ->each(function (SigningRequest $existing) use ($admin) {
                    $this->cancel($existing, $admin);
                });
        }

        // Format date-type custom fields from YYYY-MM-DD (HTML input) to DD/MM/YYYY (Australian)
        if ($template) {
            foreach ($template->placeholders ?? [] as $placeholder) {
                $key = $placeholder['key'];
                $type = $placeholder['type'] ?? 'text';
                if ($type === 'date' && ! empty($customFields[$key]) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $customFields[$key])) {
                    $customFields[$key] = \Carbon\Carbon::parse($customFields[$key])->format('d/m/Y');
                }
            }
        }

        // Build placeholder values — auto-resolve applicant fields if signable is an employment application
        $placeholderValues = array_merge($customFields, [
            'recipient_name' => $recipientName,
            'recipient_email' => $recipientEmail ?? '',
        ]);

        if ($signable instanceof \App\Models\EmploymentApplication) {
            $placeholderValues = array_merge($placeholderValues, [
                'applicant_first_name' => $signable->first_name ?? '',
                'applicant_surname' => $signable->surname ?? '',
                'applicant_full_name' => $signable->full_name ?? '',
                'applicant_email' => $signable->email ?? '',
                'applicant_phone' => $signable->phone ?? '',
                'applicant_suburb' => $signable->suburb ?? '',
                'applicant_date_of_birth' => $signable->date_of_birth?->format('d/m/Y') ?? '',
                'applicant_referred_by' => $signable->referred_by ?? '',
                'applicant_occupation' => $signable->occupation ?? '',
                'applicant_apprentice_year' => $signable->apprentice_year ? (string) $signable->apprentice_year : '',
                'applicant_trade_qualified' => $signable->trade_qualified ? 'Yes' : 'No',
                'applicant_preferred_project_site' => $signable->preferred_project_site ?? '',
                'applicant_status' => $signable->status ?? '',
            ]);
        }

        // Model-declared placeholders (namespaced, e.g. employee.first_name). Custom fields
        // already merged above win on key collision by being applied first.
        if ($signable instanceof ProvidesSigningPlaceholders) {
            foreach ($signable->signingPlaceholders() as $key => $definition) {
                $placeholderValues[$key] = $definition['value'] ?? '';
            }
        }

        // Auto-resolve sender (authenticated user) fields
        $placeholderValues = array_merge($placeholderValues, [
            'sender_name' => $admin->name ?? '',
            'sender_email' => $admin->email ?? '',
            'sender_phone' => $admin->phone ?? '',
            'sender_position' => $admin->position ?? '',
            'sender_role' => $admin->roles->first()?->name ?? '',
        ]);

        if ($template) {
            $documentHtml = $template->renderHtml($placeholderValues);
        } else {
            // One-off: render provided HTML with the same placeholder substitution as templates.
            $rendered = $documentHtml;
            foreach ($placeholderValues as $key => $value) {
                $rendered = str_replace('{{' . $key . '}}', e($value), $rendered);
            }
            // Auto-append a recipient signature block if the author didn't place one.
            if (! str_contains($rendered, '{{signature_box}}')) {
                $rendered .= '<p>{{signature_box}}</p>';
            }
            $documentHtml = $rendered;
        }

        // Replace sender signature placeholder with rendered HTML if provided
        if ($senderSignature && str_contains($documentHtml, '{{sender_signature}}')) {
            $positionLine = $senderPosition
                ? '<span style="color: #475569;">' . e($senderPosition) . '</span><br>'
                : '';
            $senderSignatureHtml = '<div class="signature-box">'
                . '<img src="' . $senderSignature . '" style="max-width: 300px; max-height: 100px;" />'
                . '<div class="signature-meta">'
                . '<strong>' . e($senderFullName ?? $admin->name) . '</strong><br>'
                . $positionLine
                . 'Signed: ' . now()->timezone('Australia/Brisbane')->format('d/m/Y h:i A T')
                . '</div></div>';
            $documentHtml = str_replace('{{sender_signature}}', $senderSignatureHtml, $documentHtml);
        }

        $documentHash = hash('sha256', $documentHtml);

        $signingRequest = SigningRequest::create([
            'document_template_id' => $template?->id,
            'document_title' => $template ? $template->name : $documentTitle,
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
            'sender_position' => $senderPosition,
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
        ?string $initialsDataUrl = null,
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

        // Store initials image
        if ($initialsDataUrl) {
            $signingRequest->addMediaFromBase64($initialsDataUrl)
                ->usingFileName('initials.png')
                ->toMediaCollection('initials');
        }

        // Generate signed PDF (with initials stamped on every page)
        $pdfContent = $this->pdfService->generate($signingRequest, $signatureDataUrl, $initialsDataUrl);

        $signingRequest->addMediaFromString($pdfContent)
            ->usingFileName('signed-document.pdf')
            ->withCustomProperties(['document_hash' => $signingRequest->document_hash])
            ->toMediaCollection('signed_document');

        $signingRequest->logEvent('pdf_generated', 'system');

        // Fire event for listeners (e.g., update employment application status)
        DocumentSigned::dispatch($signingRequest);

        // Notify admins — wrapped in try/catch so notification failures
        // (e.g. web-push encryption issues) don't break the signing flow
        try {
            $admin = $signingRequest->sentBy;
            if ($admin) {
                $admin->notify(new DocumentSignedNotification($signingRequest));
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Failed to send DocumentSigned notification', [
                'signing_request_id' => $signingRequest->id,
                'error' => $e->getMessage(),
            ]);
        }

        // Email the signer a copy of the fully-signed PDF (BCC the admin for their records)
        try {
            if ($signingRequest->recipient_email) {
                $adminBcc = $signingRequest->sentBy?->email;
                Notification::route('mail', $signingRequest->recipient_email)
                    ->notify(new SignedDocumentNotification($signingRequest, $adminBcc));
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Failed to send signed-copy email', [
                'signing_request_id' => $signingRequest->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Save a one-off document as a draft. No delivery happens, no expiry is set,
     * placeholders in the body stay unresolved so the author can continue editing.
     */
    public function createDraft(
        User $admin,
        string $documentTitle,
        string $documentHtml,
        ?Model $signable = null,
        ?string $recipientName = null,
        ?string $recipientEmail = null,
    ): SigningRequest {
        $signingRequest = SigningRequest::create([
            'document_template_id' => null,
            'document_title' => $documentTitle,
            'signable_type' => $signable ? get_class($signable) : null,
            'signable_id' => $signable?->getKey(),
            'delivery_method' => 'email',
            'token' => Str::random(64),
            'status' => 'draft',
            'sent_by' => $admin->id,
            'document_html' => $documentHtml,
            'document_hash' => null,
            'recipient_name' => $recipientName ?: '',
            'recipient_email' => $recipientEmail,
            'custom_fields' => null,
            'expires_at' => null,
        ]);

        $signingRequest->logEvent('draft_created', 'admin', $admin->id);

        return $signingRequest;
    }

    /**
     * Update an existing draft's fields without finalising it.
     */
    public function updateDraft(
        SigningRequest $signingRequest,
        User $admin,
        ?string $documentTitle = null,
        ?string $documentHtml = null,
        ?string $recipientName = null,
        ?string $recipientEmail = null,
    ): SigningRequest {
        if ($signingRequest->status !== 'draft') {
            throw new \RuntimeException('Only drafts can be updated.');
        }

        $signingRequest->update(array_filter([
            'document_title' => $documentTitle,
            'document_html' => $documentHtml,
            'recipient_name' => $recipientName,
            'recipient_email' => $recipientEmail,
        ], fn ($v) => $v !== null));

        $signingRequest->logEvent('draft_updated', 'admin', $admin->id);

        return $signingRequest;
    }

    /**
     * Convert a draft into a live signing request, going through the same
     * placeholder resolution, hashing, and delivery pipeline as a fresh send.
     */
    public function finalizeDraft(
        SigningRequest $draft,
        User $admin,
        string $deliveryMethod,
        string $recipientName,
        ?string $recipientEmail,
        ?string $senderSignature = null,
        ?string $senderFullName = null,
        ?string $senderPosition = null,
        ?string $documentTitle = null,
        ?string $documentHtml = null,
    ): SigningRequest {
        if ($draft->status !== 'draft') {
            throw new \RuntimeException('Only drafts can be finalised.');
        }

        $signable = $draft->signable;
        $title = $documentTitle ?? $draft->document_title;
        $html = $documentHtml ?? $draft->document_html;

        // Discard the draft shell; createAndSend writes a fresh row (new token, clean audit).
        $draft->logEvent('draft_finalized', 'admin', $admin->id);
        $draft->delete();

        return $this->createAndSend(
            template: null,
            deliveryMethod: $deliveryMethod,
            admin: $admin,
            recipientName: $recipientName,
            recipientEmail: $recipientEmail,
            customFields: [],
            signable: $signable,
            senderSignature: $senderSignature,
            senderFullName: $senderFullName,
            documentHtml: $html,
            documentTitle: $title,
            senderPosition: $senderPosition,
        );
    }

    public function discardDraft(SigningRequest $signingRequest, User $admin): void
    {
        if ($signingRequest->status !== 'draft') {
            throw new \RuntimeException('Only drafts can be discarded.');
        }

        $signingRequest->logEvent('draft_discarded', 'admin', $admin->id);
        $signingRequest->delete();
    }

    /**
     * Create a signing request that requires an internal user to sign first.
     * The document is NOT sent to the recipient until the internal signer completes.
     */
    public function createWithInternalSigner(
        ?DocumentTemplate $template,
        string $deliveryMethod,
        User $admin,
        string $recipientName,
        ?string $recipientEmail,
        User $internalSigner,
        array $customFields = [],
        ?Model $signable = null,
        ?string $senderFullName = null,
        ?string $senderPosition = null,
        ?string $documentHtml = null,
        ?string $documentTitle = null,
    ): SigningRequest {
        // Build placeholder values (same as createAndSend but without sender signature)
        $placeholderValues = array_merge($customFields, [
            'recipient_name' => $recipientName,
            'recipient_email' => $recipientEmail ?? '',
        ]);

        if ($signable instanceof \App\Models\EmploymentApplication) {
            $placeholderValues = array_merge($placeholderValues, [
                'applicant_first_name' => $signable->first_name ?? '',
                'applicant_surname' => $signable->surname ?? '',
                'applicant_full_name' => $signable->full_name ?? '',
                'applicant_email' => $signable->email ?? '',
                'applicant_phone' => $signable->phone ?? '',
            ]);
        }

        if ($signable instanceof ProvidesSigningPlaceholders) {
            foreach ($signable->signingPlaceholders() as $key => $definition) {
                $placeholderValues[$key] = $definition['value'] ?? '';
            }
        }

        $placeholderValues = array_merge($placeholderValues, [
            'sender_name' => $senderFullName ?? $internalSigner->name ?? '',
            'sender_email' => $internalSigner->email ?? '',
            'sender_phone' => $internalSigner->phone ?? '',
            'sender_position' => $senderPosition ?? $internalSigner->position ?? '',
            'sender_role' => $internalSigner->roles->first()?->name ?? '',
        ]);

        if ($template) {
            $renderedHtml = $template->renderHtml($placeholderValues);
        } else {
            $renderedHtml = $documentHtml;
            foreach ($placeholderValues as $key => $value) {
                $renderedHtml = str_replace('{{' . $key . '}}', e($value), $renderedHtml);
            }
            if (! str_contains($renderedHtml, '{{signature_box}}')) {
                $renderedHtml .= '<p>{{signature_box}}</p>';
            }
        }

        // Leave {{sender_signature}} unresolved — the internal signer will fill it.

        $signingRequest = SigningRequest::create([
            'document_template_id' => $template?->id,
            'document_title' => $template ? $template->name : $documentTitle,
            'signable_type' => $signable ? get_class($signable) : null,
            'signable_id' => $signable?->getKey(),
            'delivery_method' => $deliveryMethod,
            'token' => Str::random(64),
            'status' => 'awaiting_internal_signature',
            'sent_by' => $admin->id,
            'document_html' => $renderedHtml,
            'document_hash' => null, // Will be set after internal signer stamps
            'recipient_name' => $recipientName,
            'recipient_email' => $recipientEmail,
            'custom_fields' => $customFields,
            'sender_full_name' => $senderFullName,
            'sender_position' => $senderPosition,
            'internal_signer_user_id' => $internalSigner->id,
            'internal_signer_token' => Str::random(64),
            'expires_at' => null, // Clock starts after internal sign
        ]);

        $signingRequest->logEvent('created', 'admin', $admin->id, null, [
            'internal_signer' => $internalSigner->name,
        ]);

        // Notify the internal signer
        $internalSigner->notify(new InternalSignatureRequestedNotification($signingRequest));
        $signingRequest->logEvent('internal_sign_requested', 'system', null, null, [
            'to' => $internalSigner->email,
        ]);

        // System comment on signable
        if ($signable && method_exists($signable, 'addSystemComment')) {
            $signable->addSystemComment(
                "Document awaiting internal signature from {$internalSigner->name} before sending to {$recipientName}",
                ['type' => 'internal_sign_requested', 'signing_request_id' => $signingRequest->id],
                $admin->id,
            );
        }

        return $signingRequest;
    }

    /**
     * Process the internal signer's signature, stamp it into the document,
     * then deliver to the external recipient.
     */
    public function processInternalSignature(
        SigningRequest $signingRequest,
        string $signatureDataUrl,
        string $signerFullName,
        ?string $signerPosition,
        Request $request,
    ): void {
        if (! $signingRequest->isAwaitingInternalSignature()) {
            throw new \RuntimeException('This document is not awaiting an internal signature.');
        }

        // Store signature image
        $signingRequest->addMediaFromBase64($signatureDataUrl)
            ->usingFileName('internal-signature.png')
            ->toMediaCollection('internal_signature');

        // Stamp into document HTML
        $positionLine = $signerPosition
            ? '<span style="color: #475569;">' . e($signerPosition) . '</span><br>'
            : '';
        $senderSignatureHtml = '<div class="signature-box">'
            . '<img src="' . $signatureDataUrl . '" style="max-width: 300px; max-height: 100px;" />'
            . '<div class="signature-meta">'
            . '<strong>' . e($signerFullName) . '</strong><br>'
            . $positionLine
            . 'Signed: ' . now()->timezone('Australia/Brisbane')->format('d/m/Y h:i A T')
            . '</div></div>';

        $html = $signingRequest->document_html;
        $html = str_replace('{{sender_signature}}', $senderSignatureHtml, $html);

        $documentHash = hash('sha256', $html);

        $signingRequest->update([
            'document_html' => $html,
            'document_hash' => $documentHash,
            'sender_signature' => $signatureDataUrl,
            'sender_full_name' => $signerFullName,
            'sender_position' => $signerPosition,
            'internal_signed_at' => now(),
            'expires_at' => now()->addDays(7),
            'status' => 'pending',
        ]);

        $signingRequest->logEvent('internal_signed', 'admin', $signingRequest->internal_signer_user_id, $request, [
            'signer_name' => $signerFullName,
        ]);

        // Now deliver to the external recipient
        if ($signingRequest->delivery_method === 'email' && $signingRequest->recipient_email) {
            Notification::route('mail', $signingRequest->recipient_email)
                ->notify(new DocumentSigningNotification($signingRequest));
            $signingRequest->update(['status' => 'sent']);
            $signingRequest->logEvent('sent', 'system', null, null, ['method' => 'email', 'to' => $signingRequest->recipient_email]);
        } else {
            $signingRequest->update(['status' => 'sent']);
            $signingRequest->logEvent('sent', 'system', null, null, ['method' => 'in_person']);
        }

        // Notify the admin who created the request
        try {
            $admin = $signingRequest->sentBy;
            if ($admin) {
                $internalSigner = $signingRequest->internalSigner;
                $docLabel = $signingRequest->documentTemplate?->name ?? $signingRequest->document_title ?? 'Document';
                $admin->notifications()->create([
                    'id' => Str::uuid(),
                    'type' => 'InternalSignatureCompleted',
                    'data' => json_encode([
                        'type' => 'InternalSignatureCompleted',
                        'title' => 'Internal signature complete',
                        'body' => ($internalSigner?->name ?? 'A user') . " has signed \"{$docLabel}\". The document has been sent to {$signingRequest->recipient_name}.",
                        'signing_request_id' => $signingRequest->id,
                    ]),
                ]);
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Failed to notify admin after internal sign', [
                'signing_request_id' => $signingRequest->id,
                'error' => $e->getMessage(),
            ]);
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

        // Create a new one with the same parameters (works for both template and one-off)
        $template = $signingRequest->documentTemplate;

        return $this->createAndSend(
            template: $template,
            deliveryMethod: $signingRequest->delivery_method,
            admin: $admin,
            recipientName: $signingRequest->recipient_name,
            recipientEmail: $signingRequest->recipient_email,
            customFields: $signingRequest->custom_fields ?? [],
            signable: $signingRequest->signable,
            senderSignature: $signingRequest->sender_signature,
            senderFullName: $signingRequest->sender_full_name,
            documentHtml: $template ? null : $signingRequest->document_html,
            documentTitle: $template ? null : $signingRequest->document_title,
            senderPosition: $signingRequest->sender_position,
        );
    }
}
